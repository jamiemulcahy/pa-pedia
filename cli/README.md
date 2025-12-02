# PA-Pedia CLI

Command-line tool for extracting Planetary Annihilation faction data into portable faction folders.

## Installation

Download the latest release from the [Releases page](https://github.com/jamiemulcahy/pa-pedia/releases) and place `pa-pedia.exe` somewhere in your PATH.

The CLI auto-updates when new versions are available.

## Quick Start

```bash
# Extract the MLA faction (base game)
pa-pedia describe-faction --profile mla --pa-root "C:\Program Files (x86)\Steam\steamapps\common\Planetary Annihilation Titans\media"

# Extract Legion (requires mod + data-root)
pa-pedia describe-faction --profile legion --pa-root "C:\...\media" --data-root "%LOCALAPPDATA%\Uber Entertainment\Planetary Annihilation"
```

## Finding Your PA Paths

### PA Root (Media Directory)

This is where PA game files are installed:

| Platform | Typical Location |
|----------|------------------|
| Windows (Steam) | `C:\Program Files (x86)\Steam\steamapps\common\Planetary Annihilation Titans\media` |
| macOS | `~/Library/Application Support/Steam/steamapps/common/Planetary Annihilation Titans/media` |
| Linux | `~/.steam/steam/steamapps/common/Planetary Annihilation Titans/media` |

### Data Root (For Mods)

This is where PA stores downloaded mods. Only needed when extracting modded factions:

| Platform | Typical Location |
|----------|------------------|
| Windows | `%LOCALAPPDATA%\Uber Entertainment\Planetary Annihilation` |
| macOS | `~/Library/Application Support/Uber Entertainment/Planetary Annihilation` |
| Linux | `~/.local/Uber Entertainment/Planetary Annihilation` |

---

## Commands

### describe-faction

Extracts a complete faction to a folder.

#### Using Profiles (Recommended)

Profiles are pre-configured faction definitions that specify the faction name, unit type filter, and required mods.

```bash
# List available profiles
pa-pedia describe-faction --list-profiles

# Extract using a profile
pa-pedia describe-faction --profile mla --pa-root "C:\...\media"
pa-pedia describe-faction --profile legion --pa-root "C:\...\media" --data-root "C:\...\PA"
```

**Built-in Profiles:**

| Profile | Faction | Description |
|---------|---------|-------------|
| `mla` | MLA | Base game faction (no mods required) |
| `legion` | Legion | Requires Legion Expansion mod |
| `bugs` | Bugs | Requires Bugs mod |

#### Manual Mode (Advanced)

For custom configurations or factions without a profile:

```bash
pa-pedia describe-faction \
  --name "My Faction" \
  --faction-unit-type Custom99 \
  --mod com.example.my-mod \
  --pa-root "C:\...\media" \
  --data-root "C:\...\PA" \
  --output "./output"
```

### Flags Reference

#### Profile-Based Flags

| Flag | Required | Description |
|------|----------|-------------|
| `--profile` | Yes* | Profile ID to use (e.g., `mla`, `legion`) |
| `--profile-dir` | No | Directory for custom profiles (default: `./profiles`) |
| `--list-profiles` | No | List available profiles and exit |

#### Manual Mode Flags

| Flag | Required | Description |
|------|----------|-------------|
| `--name` | Yes* | Faction display name |
| `--faction-unit-type` | Yes | Unit type identifier (e.g., `Custom58` for MLA, `Custom1` for Legion) |
| `--mod` | No | Mod ID to include (can be repeated for multiple mods) |

*Either `--profile` or `--name` is required (mutually exclusive).

#### Common Flags

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--pa-root` | Yes | - | Path to PA media directory |
| `--data-root` | For mods | - | Path to PA data directory (where mods are stored) |
| `--output` | No | `./factions` | Output directory |
| `--allow-empty` | No | `false` | Allow exporting factions with 0 units |
| `-v, --verbose` | No | `false` | Enable detailed logging |

---

## Custom Profiles

You can create your own profiles for modded factions.

### Creating a Profile

1. Create a `profiles/` directory next to the CLI executable
2. Add a JSON file (e.g., `profiles/my-faction.json`):

```json
{
  "displayName": "My Faction",
  "factionUnitType": "Custom99",
  "mods": ["com.example.my-mod-server", "com.example.my-mod-client"],
  "backgroundImage": "ui/mods/my_mod/img/splash.png"
}
```

3. Use it with `--profile my-faction`

### Profile Fields

| Field | Required | Description |
|-------|----------|-------------|
| `displayName` | Yes | Faction name shown in the web app |
| `factionUnitType` | Yes | Unit type filter (e.g., `Custom1`, `Custom58`) |
| `mods` | No | Array of mod identifiers to include |
| `backgroundImage` | No | Path to faction background image |
| `author` | No | Override auto-detected mod author |
| `version` | No | Override auto-detected mod version |
| `description` | No | Override auto-detected description |

**Note:** For modded factions, metadata (author, version, description) is automatically extracted from the primary mod's `modinfo.json`. You only need to specify overrides if you want different values.

### Finding Your Faction's Unit Type

Each faction uses a unique unit type identifier. Common ones:

| Faction | Unit Type |
|---------|-----------|
| MLA (base game) | `Custom58` |
| Legion | `Custom1` |

To find a mod's unit type, check the mod's unit JSON files for `unit_types` containing `UNITTYPE_CustomXX`.

---

## Output Structure

After running `describe-faction`, you get:

```
FactionName/
├── metadata.json    # Faction info (name, version, author, mods)
├── units.json       # All units with complete resolved data
└── assets/          # Icons and images
    └── pa/
        └── units/
            └── ...
```

This folder can be:
- Uploaded to the PA-Pedia web app
- Shared with other users
- Used for mod analysis

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "PA root not found" | Verify the path points to the `media` folder inside PA Titans installation |
| "Mod not found" | Check mod identifier spelling; use `--verbose` to see discovered mods |
| "data-root is required" | Add `--data-root` flag pointing to PA's data directory (required for modded factions) |
| "directory does not appear to be a PA data directory" | The data-root path should contain `server_mods`, `client_mods`, or `download` folders |
| No units exported | Check that `--faction-unit-type` matches your faction's unit type identifier |
| 0 units with warning | The faction unit type filter didn't match any units; verify the unit type |

### Verbose Mode

Add `-v` or `--verbose` for detailed logging:

```bash
pa-pedia describe-faction --profile mla --pa-root "..." -v
```

This shows:
- All discovered mods
- Unit distribution by source
- File loading details

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PA_PEDIA_NO_UPDATE_CHECK=1` | Disable automatic update checks |

---

## Examples

### Extract Base Game (MLA)

```bash
pa-pedia describe-faction --profile mla --pa-root "C:\Program Files (x86)\Steam\steamapps\common\Planetary Annihilation Titans\media"
```

### Extract Legion

```bash
pa-pedia describe-faction --profile legion \
  --pa-root "C:\Program Files (x86)\Steam\steamapps\common\Planetary Annihilation Titans\media" \
  --data-root "%LOCALAPPDATA%\Uber Entertainment\Planetary Annihilation"
```

### Extract to Custom Location

```bash
pa-pedia describe-faction --profile mla \
  --pa-root "C:\...\media" \
  --output "D:\my-factions"
```

### List All Installed Mods

```bash
pa-pedia describe-faction --list-profiles
# Then use --verbose with any extraction to see all discovered mods
pa-pedia describe-faction --profile mla --pa-root "..." -v
```
