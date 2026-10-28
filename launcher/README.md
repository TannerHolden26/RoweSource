# Wii-style launcher for Delta

A Wii Menu–style home screen for the [Delta](https://deltaemulator.com) emulator on iPhone.
It runs as a web app that you add to your Home Screen. Each channel opens a game
straight into Delta.

- Wii Menu channel grid with glowing selection, page arrows and swipe between pages
- Bottom bar with the big clock and date, plus the round **Wii** and **mail** buttons
- Tapping a channel zooms into a channel preview with **Wii Menu** and **Start** buttons
- Menu sounds (you can turn them off from the mail button)
- The first channel always opens Delta itself, like the Disc Channel
- Your channels are saved on your phone. Use **Back Up Channels** to keep a copy.

## How games are launched

Delta can open a game from a link of the form `delta://game/<game ID>`, where the
game ID is the SHA-1 hash of the ROM file. When you add a channel, tap
**Choose ROM…** and pick the same ROM you imported into Delta. The launcher works out
the ID on your phone, and the ROM isn't uploaded anywhere. If a channel has no
game ID, **Start** just opens Delta.

## Put it on your iPhone

The page has to be served over `https` (it won't work as a file opened from the Files app).
The easiest free option is GitHub Pages:

1. On GitHub, open this repository and go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*, pick the
   branch that has the `launcher` folder, choose the `/ (root)` folder and click **Save**.
3. After a minute or two the launcher is live at
   `https://<your-username>.github.io/RoweSource/launcher/`.
4. Open that link in **Safari** on your iPhone, tap the **Share** button, then
   **Add to Home Screen**.
5. Open **Game Menu** from your Home Screen. It opens full screen like an app.
   Turn your phone sideways for the classic 4 × 3 Wii layout.

GitHub Pages on a private repository needs a paid GitHub plan. If yours is private,
put the files in `launcher/` into any free static host (for example a separate public
repository with Pages turned on).

## Adding channels

- Tap an empty slot, or press **Wii → Add a Channel**.
- Choose the ROM, check the name and console, and optionally pick channel art (any
  image from your Photos, such as box art or a screenshot).
- Press and hold a channel to edit it, move it, or delete it.

Tip: put Game Menu on your Home Screen where Delta's icon used to be, and move Delta
into the App Library. You'll go through the launcher every time.
