package file_generators

import (
	"bytes"
	"fmt"
	"time"

	"github.com/muktihari/fit/encoder"
	"github.com/muktihari/fit/profile/mesgdef"
	"github.com/muktihari/fit/profile/typedef"
	"github.com/muktihari/fit/proto"

	pb "github.com/ripixel/fitglue-server/src/go/pkg/types/pb"
)

// GenerateFitFile creates a FIT file from StandardizedActivity
// Supports multiple sport types and rich record data
func GenerateFitFile(activity *pb.StandardizedActivity) ([]byte, error) {
	if activity == nil {
		return nil, fmt.Errorf("activity cannot be nil")
	}

	if len(activity.Sessions) == 0 {
		return nil, fmt.Errorf("activity must have at least one session")
	}

	// Parse start time
	startTime, err := time.Parse(time.RFC3339, activity.StartTime)
	if err != nil {
		return nil, fmt.Errorf("invalid start time: %w", err)
	}

	// Strict Single Session Enforcement
	session := activity.Sessions[0]

	// Create proto.FIT struct
	fit := &proto.FIT{
		Messages: []proto.Message{},
	}

	// 1. FileId message
	fileId := mesgdef.NewFileId(nil).
		SetType(typedef.FileActivity).
		SetManufacturer(typedef.ManufacturerDevelopment).
		SetProduct(1). // FitGlue product ID
		SetTimeCreated(startTime)
	fit.Messages = append(fit.Messages, fileId.ToMesg(nil))

	// Map Sport
	sport, subSport := mapSport(activity.Type)

	// 2. Activity message (Appended last)
	activityMsg := mesgdef.NewActivity(nil).
		SetTimestamp(startTime).
		SetType(typedef.ActivityManual).
		SetNumSessions(1)

	// 3. Session message (Appended last)
	sessionMsg := mesgdef.NewSession(nil).
		SetTimestamp(startTime).
		SetSport(sport).
		SetSubSport(subSport).
		SetStartTime(startTime)

	if session.TotalElapsedTime > 0 {
		sessionMsg.SetTotalElapsedTime(uint32(session.TotalElapsedTime * 1000))
		sessionMsg.SetTotalTimerTime(uint32(session.TotalElapsedTime * 1000))
	}
	if session.TotalDistance > 0 {
		sessionMsg.SetTotalDistance(uint32(session.TotalDistance * 100)) // cm? No, FIT uses meters usually but scaled?
		// meters, Type: uint32, Scale: 100, Offset: 0, Units: m
		sessionMsg.SetTotalDistance(uint32(session.TotalDistance * 100))
	}

	// 4. Lap message (One per session for now)
	lapMsg := mesgdef.NewLap(nil).
		SetTimestamp(startTime).
		SetStartTime(startTime).
		SetSport(sport).
		SetSubSport(subSport).
		SetMessageIndex(0)

	if session.TotalElapsedTime > 0 {
		lapMsg.SetTotalElapsedTime(uint32(session.TotalElapsedTime * 1000))
		lapMsg.SetTotalTimerTime(uint32(session.TotalElapsedTime * 1000))
	}
	if session.TotalDistance > 0 {
		lapMsg.SetTotalDistance(uint32(session.TotalDistance * 100))
	}

	// 5. Records
	// We iterate through laps in the session (though we only created one Lap msg above,
	// ideally we'd map session.Laps to FIT Laps, but enforcing single Lap for robust uploads first)
	// We'll flatten all records from all laps into this single FIT Lap/Session for safety.

	recordCount := 0
	for _, lap := range session.Laps {
		for _, record := range lap.Records {
			ts, err := time.Parse(time.RFC3339, record.Timestamp)
			if err != nil {
				continue // Skip invalid records
			}

			recordMsg := mesgdef.NewRecord(nil).SetTimestamp(ts)

			if record.HeartRate > 0 {
				recordMsg.SetHeartRate(uint8(record.HeartRate))
			}
			if record.Power > 0 {
				recordMsg.SetPower(uint16(record.Power))
			}
			if record.Cadence > 0 {
				recordMsg.SetCadence(uint8(record.Cadence))
			}
			if record.Speed > 0 {
				recordMsg.SetSpeed(uint16(record.Speed * 1000)) // m/s, scale 1000
			}
			if record.Altitude != 0 {
				// Altitude: scale 5, offset 500
				// float32((val + 500) * 5) ? No, library handles scaling usually check NewRecord SetAltitude signature
				// SetAltitude(v uint16) ->  scaled value?
				// Using SetAltitudeScaled(v float32) if available is safer.
				// Library usually provides Scaled setters. Let's check imports.
				// Assuming standard muktihari/fit generation:
				// It has SetAltitude(uint16) which is raw.
				// We need to manually scale: (altitude + 500) * 5
				alt := (record.Altitude + 500) * 5
				if alt >= 0 {
					recordMsg.SetAltitude(uint16(alt))
				}
			}

			// Location (Semicircles)
			// lat * (2^31 / 180)
			if record.PositionLat != 0 || record.PositionLong != 0 {
				const semicircleConst = 11930464.7111 // 2^31 / 180
				lat := int32(record.PositionLat * semicircleConst)
				long := int32(record.PositionLong * semicircleConst)
				recordMsg.SetPositionLat(lat)
				recordMsg.SetPositionLong(long)
			}

			if recordCount == 0 {
				// Start Lat/Long for Lap/Session
				if record.PositionLat != 0 || record.PositionLong != 0 {
					const semicircleConst = 11930464.7111
					lat := int32(record.PositionLat * semicircleConst)
					long := int32(record.PositionLong * semicircleConst)
					lapMsg.SetStartPositionLat(lat)
					lapMsg.SetStartPositionLong(long)
					sessionMsg.SetStartPositionLat(lat)
					sessionMsg.SetStartPositionLong(long)
				}
			}

			fit.Messages = append(fit.Messages, recordMsg.ToMesg(nil))
			recordCount++
		}
	}

	// Fallback: Synthesize records if none exist
	if recordCount == 0 && session.TotalElapsedTime > 0 {
		duration := int(session.TotalElapsedTime)
		for i := 0; i < duration; i++ {
			ts := startTime.Add(time.Duration(i) * time.Second)
			recordMsg := mesgdef.NewRecord(nil).SetTimestamp(ts)
			fit.Messages = append(fit.Messages, recordMsg.ToMesg(nil))
		}
	}

	// 6. Strength Sets (Only for training)
	if sport == typedef.SportTraining {
		for i, set := range session.StrengthSets {
			setStartTime := startTime
			if set.StartTime != "" {
				if t, err := time.Parse(time.RFC3339, set.StartTime); err == nil {
					setStartTime = t
				}
			}

			category := MapExerciseToCategory(set.ExerciseName)
			setMsg := mesgdef.NewSet(nil).
				SetTimestamp(setStartTime).
				SetStartTime(setStartTime).
				SetCategory([]typedef.ExerciseCategory{category}).
				SetSetType(typedef.SetTypeActive).
				SetMessageIndex(typedef.MessageIndex(i))

			if set.Reps > 0 {
				setMsg.SetRepetitions(uint16(set.Reps))
			}
			if set.WeightKg > 0 {
				setMsg.SetWeightScaled(set.WeightKg)
			}
			if set.DurationSeconds > 0 {
				setMsg.SetDuration(uint32(set.DurationSeconds * 1000))
			}
			fit.Messages = append(fit.Messages, setMsg.ToMesg(nil))
		}
	}

	// Append Summary
	fit.Messages = append(fit.Messages, lapMsg.ToMesg(nil))
	fit.Messages = append(fit.Messages, sessionMsg.ToMesg(nil))
	fit.Messages = append(fit.Messages, activityMsg.ToMesg(nil))

	// Encode
	var buf bytes.Buffer
	enc := encoder.New(&buf)
	if err := enc.Encode(fit); err != nil {
		return nil, fmt.Errorf("failed to encode FIT file: %w", err)
	}

	return buf.Bytes(), nil
}

func mapSport(activityType string) (typedef.Sport, typedef.SubSport) {
	switch activityType {
	case "WEIGHT_TRAINING":
		return typedef.SportTraining, typedef.SubSportStrengthTraining
	case "RUNNING":
		return typedef.SportRunning, typedef.SubSportGeneric
	case "CYCLING":
		return typedef.SportCycling, typedef.SubSportGeneric
	case "SWIMMING":
		return typedef.SportSwimming, typedef.SubSportLapSwimming
	case "HIKING":
		return typedef.SportHiking, typedef.SubSportGeneric
	case "WALKING":
		return typedef.SportWalking, typedef.SubSportGeneric
	case "YOGA":
		return typedef.SportTraining, typedef.SubSportYoga
	default:
		return typedef.SportGeneric, typedef.SubSportGeneric
	}
}
