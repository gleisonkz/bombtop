# Bombtopia

Multiplayer arena bomb game for the browser (installable PWA). Up to 5 players online,
or 2 on one keyboard locally. All art and names are original.

```bash
pnpm install
pnpm test
pnpm dev      # client http://localhost:5173 + game server ws://localhost:2567
```

## Controls

| | Move | Bomb | Action (detonate / punch / mount) |
|---|---|---|---|
| Keyboard P1 | `WASD` | `Space` | `Left Shift` |
| Keyboard P2 | arrows | `Enter` | `Right Shift` |
| Gamepad | d-pad / left stick | A | B or X |
| Touch | left-side joystick | 💣 | AÇÃO |

Online, either keyboard layout, a gamepad or touch controls the same player. `Esc` returns to the menu.

## Configuration

Copy `apps/client/.env.example` and `apps/server/.env.example` to `.env`. Without Supabase
settings the game runs guest-only.

See `CLAUDE.md` for architecture decisions.
