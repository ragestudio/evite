### Extension
Use CommonJS module

| Property | Type | Description |
| -------- | ---- | ----------- |
| id | *required* [String()] | UUID of the extension (Needed to load into addon manager) |
| dependencies | [Array()] | Inject dependencies with corenode package manager |
| self | [Object()] | Extends self(this) context with provided declared properties |
| overrideBeforeConfig | [fn()] | Override server configuration before initialization. [METHOD]("") |