# PokéPet for iPhone

The native iPhone version of PokéPet, a Tamagotchi-style virtual Pokémon. It adds things
the web version can't do:

- **Reminders.** Notifications when your Pokémon gets hungry, bored, messy or sleepy,
  even when the app is closed.
- **Daycare.** Turn it on in Stats → Options when you'll be away (at work, or while the
  app's 7-day free signing has run out). Needs drain 10 times slower, there are no
  messes, and it can't get sick.
- **Backups.** Stats → Options → **Back up to Files** saves your Pokémon as a file;
  **Restore a backup** loads it back.

Your save is kept on your phone. Reinstalling from Xcode keeps it, and only deleting the
app erases it.

## Install it on your iPhone (free Apple ID)

You need a Mac with the latest Xcode from the Mac App Store, your iPhone, and a cable for the
first install.

1. **Open the project.** Double-click `PokePet.xcodeproj`.
2. **Sign in.** Xcode → Settings → Accounts → **+** → Apple ID, and sign in.
3. **Pick your team.** In the left sidebar click **PokePet** (blue icon), choose the
   **PokePet** target, open **Signing & Capabilities**, and set **Team** to
   *Your Name (Personal Team)*.
   - If Xcode says the bundle identifier is unavailable, change
     `com.tannerholden26.PokePet` to something unique, like `com.yourname.PokePet`.
4. **Connect your iPhone** with a cable, unlock it, and tap **Trust** if asked.
5. **Turn on Developer Mode** on the iPhone: Settings → Privacy & Security →
   **Developer Mode** → On, then restart the phone when it asks.
6. **Pick your iPhone** in the device menu at the top of the Xcode window, then press
   **Run** (▶).
7. **Trust the app** on the iPhone the first time: Settings → General →
   **VPN & Device Management** → your Apple ID → **Trust**. Then open PokéPet.

### Every 7 days

With a free Apple ID the app stops opening after 7 days. Open the project and press **Run**
again. Your Pokémon is kept. After the first time, Xcode can install over Wi-Fi when your
iPhone and Mac are on the same network (Window → Devices and Simulators → your iPhone →
**Connect via network**).

## How it plays

The same rules as the web version: an egg hatches into Pichu, Cyndaquil, Totodile or
Chikorita, needs drain in real time, and good care makes it evolve after 1 day and again
after 3 days. Tap your Pokémon to pet it.

| Button | What it does |
|---|---|
| Stats | Needs, profile, and options (reminders, daycare, rename, backup, release). |
| Feed | Oran Berry fills its tummy. Poké Puff is a treat that makes it happy. |
| Play | "Which way?" Guess which way it'll turn, 5 rounds. |
| Clean | Cleans up messes. |
| Medicine | Cures it when it's sick. |
| Lights | Puts it to bed or wakes it up. |
