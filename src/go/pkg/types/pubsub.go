package types

// PubSubMessage is the payload of a Pub/Sub event via Cloud Event.
type PubSubMessage struct {
	Message struct {
		Data       []byte            `json:"data"`
		Attributes map[string]string `json:"attributes"`
	} `json:"message"`
}
