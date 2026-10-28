# PokéPet

A Tamagotchi-style virtual Pokémon for your iPhone. It's a web app you add to your Home
Screen; it opens full screen and works offline.

## How it plays

- You start with an **egg**. It hatches after about a minute into **Pichu**, **Cyndaquil**,
  **Totodile** or **Chikorita** (it's a surprise!), and you give it a nickname.
- It lives in **real time**, even while the app is closed. It gets hungry over about 7 hours,
  bored over about 9, sleepy after a long day, and leaves a mess every few hours.
- A flashing **!** on the screen and a flashing button tell you what it needs.
- If it's neglected for too long it can **get sick**, and eventually **faint** (you can take it
  to the Pokémon Center, but it'll trust you a little less).
- Take good care of it and it **evolves**: after 1 day with good friendship, and again after
  3 days with great friendship (Pichu → Pikachu → Raichu, and so on).

| Button | What it does |
|---|---|
| 📊 Stats | Hunger, happiness, energy, health and friendship. Tap the sides to see its profile and options (sound, rename, release). |
| 🫐 Feed | Oran Berry fills its tummy. Poké Puff is a treat that makes it happy. |
| ◓ Play | "Which way?" Guess which way it'll turn, 5 rounds. Win 3 to make it extra happy. |
| 🧹 Clean | Cleans up messes. |
| ✚ Medicine | Cures it when it's sick. |
| 🌙 Lights | Puts it to bed or wakes it up. It also falls asleep by itself when exhausted. |

Tap your Pokémon to pet it.

## Play it

PokéPet is published as a private page on claude.ai, so it opens from a link in Safari
or the Claude app while you're signed in. There, your Pokémon is saved to your account,
so it follows you between devices.

## Host it yourself (optional)

You can also serve it from GitHub Pages, the same way as the launcher. This needs a public
repository or a paid GitHub plan:

1. On GitHub, open this repository and go to **Settings → Pages**.
2. Set **Source** to *Deploy from a branch*, pick the branch with the `pokepet` folder and
   the `/ (root)` folder, and click **Save**.
3. After a minute or two it's at `https://<your-username>.github.io/RoweSource/pokepet/`.
4. Open that link in **Safari**, tap **Share → Add to Home Screen**, and open **PokéPet**
   from your Home Screen.

When self-hosted, your Pokémon is saved on your phone, in the Home Screen app. (Opening the
link in Safari instead gives you a separate save.)

Sprites are Pokémon Black/White animated sprites from the PokéAPI sprites collection.
