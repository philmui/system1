"""Persist before notifying. SSE reads the log, so notification loss is harmless."""

import asyncio

from .storage import Storage


class Events:
    def __init__(self, storage: Storage):
        self.storage = storage
        self.changed = asyncio.Condition()

    async def emit(self, run_id, type, instance_id, payload, parent_instance_id=None, attempt=1, key=None):
        event = self.storage.append_event(
            run_id, type, instance_id, payload, parent_instance_id, attempt, key
        )
        async with self.changed:
            self.changed.notify_all()
        return event

    async def wait(self, seconds=1):
        async with self.changed:
            try:
                await asyncio.wait_for(self.changed.wait(), seconds)
            except TimeoutError:
                pass
