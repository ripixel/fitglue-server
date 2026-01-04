package enricher_providers

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/ripixel/fitglue-server/src/go/pkg/domain/activity"
	pb "github.com/ripixel/fitglue-server/src/go/pkg/types/pb"
)

type TypeMappingRule struct {
	Substring  string `json:"substring"`
	TargetType string `json:"target_type"` // Can be friendly name like "Run" or enum like "ACTIVITY_TYPE_RUN"
}

type TypeMapperProvider struct{}

func init() {
	Register(NewTypeMapperProvider())
}

func NewTypeMapperProvider() *TypeMapperProvider {
	return &TypeMapperProvider{}
}

func (p *TypeMapperProvider) Name() string {
	return "type-mapper"
}

func (p *TypeMapperProvider) ProviderType() pb.EnricherProviderType {
	return pb.EnricherProviderType_ENRICHER_PROVIDER_TYPE_MAPPER
}

func (p *TypeMapperProvider) Enrich(ctx context.Context, act *pb.StandardizedActivity, user *pb.UserRecord, inputConfig map[string]string, doNotRetry bool) (*EnrichmentResult, error) {
	rulesJson, ok := inputConfig["rules"]
	if !ok || rulesJson == "" {
		// No rules configured, nothing to do
		return &EnrichmentResult{}, nil
	}

	var rules []TypeMappingRule
	if err := json.Unmarshal([]byte(rulesJson), &rules); err != nil {
		// Silent failure on invalid config is safer than crashing pipeline.
		return &EnrichmentResult{}, nil
	}

	activityName := strings.ToLower(act.Name)
	originalType := act.Type
	var newType pb.ActivityType
	var substring string

	for _, rule := range rules {
		if rule.Substring == "" || rule.TargetType == "" {
			continue
		}
		if strings.Contains(activityName, strings.ToLower(rule.Substring)) {
			// Parse the target type (accepts both friendly names and enum names)
			newType = activity.ParseActivityTypeFromString(rule.TargetType)
			if newType != pb.ActivityType_ACTIVITY_TYPE_UNSPECIFIED {
				act.Type = newType
				substring = rule.Substring
				break // First match wins
			}
		}
	}

	if newType != pb.ActivityType_ACTIVITY_TYPE_UNSPECIFIED {
		return &EnrichmentResult{
			Metadata: map[string]string{
				"original_type": activity.GetStravaActivityType(originalType),
				"new_type":      activity.GetStravaActivityType(newType),
				"rule_matched":  substring,
			},
		}, nil
	}

	return &EnrichmentResult{}, nil
}
