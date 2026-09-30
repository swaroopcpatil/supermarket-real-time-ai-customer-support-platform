from datetime import UTC, datetime
from uuid import uuid4
from pydantic import BaseModel, Field


class EventSchema(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    event_type: str
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    source: str
    payload: dict


class EventBus:
    """In-memory fallback event bus when Kafka is offline / mock mode."""
    _listeners = {}

    @classmethod
    def subscribe(cls, topic: str, handler):
        if topic not in cls._listeners:
            cls._listeners[topic] = []
        cls._listeners[topic].append(handler)

    @classmethod
    async def publish(cls, topic: str, event: EventSchema):
        handlers = cls._listeners.get(topic, [])
        for h in handlers:
            try:
                await h(event)
            except Exception as e:
                print(f"[EventBus Error] Topic {topic}: {e}")
