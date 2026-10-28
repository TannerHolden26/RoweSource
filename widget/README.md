# R.O.W.E. iPhone Widget

A home-screen widget that shows a **Pokémon of the Day**, with a different Pokémon
(#001–#898) each day. About 1 day in 16 it shows the shiny sprite ✨.

| Size   | Shows                                                    |
|--------|----------------------------------------------------------|
| Small  | Sprite, dex number, name, types                          |
| Medium | Everything above, plus category and the Pokédex entry    |
| Large  | Everything above, plus base stat bars and the stat total |

The background color matches the Pokémon's primary type. Tapping the widget opens
the R.O.W.E. thread on PokéCommunity. Data comes from [PokéAPI](https://pokeapi.co).
The widget caches the last Pokémon it loaded, so it still shows something when
you're offline.

## Install

1. Install **Scriptable** (free) from the App Store.
2. In Scriptable, tap **+** to make a new script, then paste in the contents of
   [`RoweDexWidget.js`](RoweDexWidget.js).
3. Tap the script's title and rename it to `RoweDex`. Tap ▶︎ to preview it.
4. Go to your home screen, long-press an empty spot, tap **Edit → Add Widget**,
   pick **Scriptable**, and choose a size.
5. Long-press the new widget, tap **Edit Widget**, and set **Script** to `RoweDex`.

## Customize

Change the settings at the top of `RoweDexWidget.js`:

- `MAX_DEX`: set it to `386` to only show Gen 1–3 Pokémon.
- `SHINY_ODDS`: lower numbers mean more shiny days.
- `TAP_URL`: the page the widget opens when you tap it.
