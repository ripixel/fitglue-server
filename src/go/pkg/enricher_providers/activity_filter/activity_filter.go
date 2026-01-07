package activity_filter

import (
	"context"
	"fmt"
	"strings"

	"github.com/ripixel/fitglue-server/src/go/pkg/enricher_providers"
	pb "github.com/ripixel/fitglue-server/src/go/pkg/types/pb"
)

// ActivityFilterProvider filters activities based on type, title, or description patterns.
// When conditions match, it halts the pipeline (activity is skipped, not failed).
type ActivityFilterProvider struct{}

func init() {
	enricher_providers.Register(NewActivityFilterProvider())
}

func NewActivityFilterProvider() *ActivityFilterProvider {
	return &ActivityFilterProvider{}
}

func (p *ActivityFilterProvider) Name() string {
	return "activity_filter"
}

func (p *ActivityFilterProvider) ProviderType() pb.EnricherProviderType {
	return pb.EnricherProviderType_ENRICHER_PROVIDER_ACTIVITY_FILTER
}

func (p *ActivityFilterProvider) Enrich(ctx context.Context, act *pb.StandardizedActivity, user *pb.UserRecord, inputs map[string]string, doNotRetry bool) (*enricher_providers.EnrichmentResult, error) {
	// Check exclude_activity_types
	if excludeTypes := inputs["exclude_activity_types"]; excludeTypes != "" {
		actType := act.Type.String()
		for _, t := range strings.Split(excludeTypes, ",") {
			t = strings.TrimSpace(t)
			// Match by name (e.g., "WALK", "YOGA") or full enum name
			if strings.EqualFold(t, actType) ||
				strings.EqualFold("ACTIVITY_TYPE_"+t, actType) {
				return &enricher_providers.EnrichmentResult{
					HaltPipeline: true,
					HaltReason:   fmt.Sprintf("Activity type %s is excluded", actType),
					Metadata: map[string]string{
						"filter_applied": "true",
						"filter_reason":  "activity_type_excluded",
						"excluded_type":  t,
					},
				}, nil
			}
		}
	}

	// Check exclude_title_contains
	if excludeTitle := inputs["exclude_title_contains"]; excludeTitle != "" {
		titleLower := strings.ToLower(act.Name)
		for _, pattern := range strings.Split(excludeTitle, ",") {
			pattern = strings.TrimSpace(strings.ToLower(pattern))
			if pattern != "" && strings.Contains(titleLower, pattern) {
				return &enricher_providers.EnrichmentResult{
					HaltPipeline: true,
					HaltReason:   fmt.Sprintf("Title contains excluded pattern: %s", pattern),
					Metadata: map[string]string{
						"filter_applied":   "true",
						"filter_reason":    "title_pattern_excluded",
						"excluded_pattern": pattern,
					},
				}, nil
			}
		}
	}

	// Check exclude_description_contains
	if excludeDesc := inputs["exclude_description_contains"]; excludeDesc != "" {
		descLower := strings.ToLower(act.Description)
		for _, pattern := range strings.Split(excludeDesc, ",") {
			pattern = strings.TrimSpace(strings.ToLower(pattern))
			if pattern != "" && strings.Contains(descLower, pattern) {
				return &enricher_providers.EnrichmentResult{
					HaltPipeline: true,
					HaltReason:   fmt.Sprintf("Description contains excluded pattern: %s", pattern),
					Metadata: map[string]string{
						"filter_applied":   "true",
						"filter_reason":    "description_pattern_excluded",
						"excluded_pattern": pattern,
					},
				}, nil
			}
		}
	}

	// No filter matched - activity passes through
	return &enricher_providers.EnrichmentResult{
		Metadata: map[string]string{
			"filter_applied": "false",
		},
	}, nil
}
