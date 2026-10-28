import Combine
import SwiftUI

struct ContentView: View {
    @EnvironmentObject var store: PetStore
    @Environment(\.scenePhase) var scenePhase

    // Screen state (internal so the panel views in Panels.swift can use it).
    @State var panel: Panel?
    @State var toast: Toast?
    @State var floaters: [Floater] = []
    @State var jump = false
    @State var wanderX: CGFloat = 0
    @State var facingRight = false
    @State var flash: Double = 0
    @State var busy = false
    @State var feeding: Food?
    @State var bites = 0
    @State var sweeping = false
    @State var game = GameState()
    @State var nameDraft = ""
    @State var exporting = false
    @State var importing = false

    let clock = Timer.publish(every: 5, on: .main, in: .common).autoconnect()
    let stroll = Timer.publish(every: 3, on: .main, in: .common).autoconnect()

    var pet: Pet { store.pet }
    var needs: [Need] { store.pet.needs }

    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(hex: 0x4a3d73), Color(hex: 0x2b2340), Color(hex: 0x1d1730)],
                           startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
            device
                .padding(.horizontal, 16)
                .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
                    restore(result)
                }
        }
        .ignoresSafeArea(.keyboard)
        .fileExporter(isPresented: $exporting, document: BackupDocument(data: store.backupData()),
                      contentType: .json, defaultFilename: "PokePet Backup") { result in
            if case .success = result { showToast("Backup saved") }
        }
        .onAppear(perform: tick)
        .onReceive(clock) { _ in tick() }
        .onReceive(stroll) { _ in wander() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                tick()
            } else {
                store.save()
                store.scheduleNotifications()
            }
        }
    }

    // MARK: - Device

    var device: some View {
        VStack(spacing: 12) {
            Text("POKÉPET")
                .font(.system(size: 15, weight: .black, design: .rounded))
                .tracking(2)
                .foregroundStyle(Color(hex: 0xfff0d7, opacity: 0.9))
            HStack(spacing: 20) {
                IconButton(symbol: "chart.bar.fill", label: "Stats", attention: false, action: openStats)
                IconButton(symbol: "fork.knife", label: "Feed", attention: needs.contains(.hungry), action: openFeed)
                IconButton(symbol: "gamecontroller.fill", label: "Play", attention: needs.contains(.bored), action: startGame)
            }
            screen
            HStack(spacing: 20) {
                IconButton(symbol: "sparkles", label: "Clean", attention: needs.contains(.dirty), action: clean)
                IconButton(symbol: "cross.case.fill", label: "Medicine", attention: needs.contains(.sick), action: heal)
                IconButton(symbol: pet.asleep ? "sun.max.fill" : "moon.fill", label: pet.asleep ? "Wake up" : "Lights out",
                           attention: needs.contains(.sleepy), action: toggleSleep)
            }
        }
        .padding(.horizontal, 40)
        .padding(.top, 56)
        .padding(.bottom, 60)
        .background(shell)
        .frame(maxWidth: 420)
    }

    var shell: some View {
        ZStack {
            EggShape().fill(LinearGradient(colors: [Theme.shellLight, Theme.shellDark],
                                           startPoint: .topLeading, endPoint: .bottomTrailing))
            EggShape().fill(RadialGradient(colors: [.white.opacity(0.5), .clear], center: UnitPoint(x: 0.3, y: 0.16),
                                           startRadius: 0, endRadius: 170))
            EggShape().stroke(Theme.shellEdge.opacity(0.6), lineWidth: 2)
        }
        .shadow(color: .black.opacity(0.45), radius: 22, y: 16)
    }

    var screen: some View {
        GeometryReader { geo in
            lcd(size: geo.size)
        }
        .aspectRatio(1.08, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 18).fill(Theme.bezel))
    }

    // MARK: - LCD

    func lcd(size: CGSize) -> some View {
        let w = size.width
        let h = size.height
        let groundY = h * 0.82
        let petX = wanderX * w * 0.22
        return ZStack {
            LCDBackground(night: pet.asleep)
            topBar
            creature(w: w)
                .offset(x: petX, y: jump ? -14 : 0)
                .frame(width: w, height: groundY, alignment: .bottom)
                .frame(width: w, height: h, alignment: .top)
            if let food = feeding {
                Text(food.emoji)
                    .font(.system(size: w * 0.1))
                    .scaleEffect(max(0.05, 1 - CGFloat(bites) / 3))
                    .offset(x: petX - w * 0.2)
                    .frame(width: w, height: groundY, alignment: .bottom)
                    .frame(width: w, height: h, alignment: .top)
            }
            poops(w: w, groundY: groundY)
            if pet.sick && pet.phase == .alive {
                Image(systemName: "tornado")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Color(hex: 0x7b2cbf))
                    .padding(.top, 28)
                    .padding(.trailing, 10)
                    .frame(width: w, height: h, alignment: .topTrailing)
            }
            floaterLayer(x: w / 2 + petX, y: groundY - h * 0.45)
            if pet.asleep && pet.phase == .alive {
                zzz(w: w, h: h)
            }
            if let panel {
                panelView(panel)
            }
            if let toast {
                Text(toast.text)
                    .font(Theme.mono(11))
                    .foregroundStyle(Theme.lcd)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 4)
                    .background(RoundedRectangle(cornerRadius: 6).fill(Theme.ink))
                    .padding(.top, 30)
                    .frame(width: w, height: h, alignment: .top)
                    .allowsHitTesting(false)
            }
            Color.white.opacity(flash).allowsHitTesting(false)
        }
        .frame(width: w, height: h)
    }

    var topBar: some View {
        HStack {
            Text(pet.phase == .egg ? "EGG" : pet.displayName)
            Spacer()
            if !needs.isEmpty {
                TimelineView(.periodic(from: .now, by: 0.5)) { context in
                    Text("!")
                        .font(Theme.mono(15, .black))
                        .foregroundStyle(Theme.alert)
                        .opacity(Int(context.date.timeIntervalSinceReferenceDate * 2) % 2 == 0 ? 1 : 0)
                }
            }
            Spacer()
            Text(pet.phase == .egg ? "" : "\(Int(pet.ageHours / 24))d")
        }
        .font(Theme.mono(12))
        .foregroundStyle(pet.asleep ? Color(hex: 0xe6ebf5) : Theme.ink)
        .padding(.horizontal, 8)
        .padding(.top, 6)
        .frame(maxHeight: .infinity, alignment: .top)
    }

    @ViewBuilder
    func creature(w: CGFloat) -> some View {
        if pet.phase == .egg {
            TimelineView(.animation) { context in
                EggView(cracked: Date().timeIntervalSince(pet.created) > Rules.hatchSeconds * 0.6)
                    .rotationEffect(.degrees(wobble(at: context.date)), anchor: .bottom)
            }
            .frame(width: w * 0.26, height: w * 0.32)
            .contentShape(Rectangle())
            .onTapGesture { Haptics.tap() }
        } else {
            PixelSprite(dex: pet.species.dex, scale: w / 128)
                .scaleEffect(x: facingRight ? -1 : 1, y: 1) // sprites face left; flip to face right
                .hueRotation(.degrees(pet.sick && pet.phase == .alive ? 60 : 0))
                .grayscale(pet.phase == .fainted ? 1 : 0)
                .brightness(pet.asleep ? -0.2 : 0)
                .rotationEffect(.degrees(pet.phase == .fainted ? 80 : 0), anchor: .bottom)
                .contentShape(Rectangle())
                .onTapGesture(perform: petIt)
        }
    }

    func wobble(at date: Date) -> Double {
        let cycle = date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 1.2) / 1.2
        guard cycle > 0.6 else { return 0 }
        let p = (cycle - 0.6) / 0.4
        return sin(p * .pi * 3) * 9 * (1 - p)
    }

    func poops(w: CGFloat, groundY: CGFloat) -> some View {
        HStack(spacing: 0) {
            ForEach(0..<(pet.phase == .alive ? pet.poops : 0), id: \.self) { _ in
                Text("💩").font(.system(size: w * 0.075))
            }
        }
        .offset(x: sweeping ? w : 0)
        .padding(.trailing, 6)
        .frame(width: w, height: groundY + w * 0.02, alignment: .bottomTrailing)
        .frame(maxHeight: .infinity, alignment: .top)
        .allowsHitTesting(false)
    }

    func floaterLayer(x: CGFloat, y: CGFloat) -> some View {
        ForEach(floaters) { floater in
            TimelineView(.animation) { context in
                let p = min(1, context.date.timeIntervalSince(floater.start) / 1.4)
                Text(floater.text)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Theme.alert)
                    .opacity(1 - p)
                    .position(x: x, y: y - CGFloat(p) * 46)
            }
            .allowsHitTesting(false)
        }
    }

    func zzz(w: CGFloat, h: CGFloat) -> some View {
        TimelineView(.animation) { context in
            ZStack {
                ForEach(0..<3, id: \.self) { i in
                    let p = (context.date.timeIntervalSinceReferenceDate + Double(i) * 0.8)
                        .truncatingRemainder(dividingBy: 2.4) / 2.4
                    Text(i == 1 ? "z" : "Z")
                        .font(Theme.mono(14, .black))
                        .foregroundStyle(Color(hex: 0xe6ebf5))
                        .opacity(p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7)
                        .position(x: w * 0.6 + CGFloat(p) * 18, y: h * 0.4 - CGFloat(p) * 40)
                }
            }
        }
        .allowsHitTesting(false)
    }

    // MARK: - Time passing

    func tick() {
        store.tick()
        guard panel == nil, !busy else { return }
        if store.readyToHatch {
            hatch()
        } else if pet.phase == .fainted {
            showFainted()
        } else if pet.phase == .alive && pet.pendingEvolution {
            runEvolution()
        }
    }

    func wander() {
        guard pet.phase == .alive, !pet.asleep, panel == nil, !busy else { return }
        let target = CGFloat.random(in: -0.85...0.85)
        facingRight = target > wanderX
        withAnimation(.linear(duration: 1.6)) { wanderX = target }
    }

    // MARK: - Big moments

    func hatch() {
        busy = true
        store.hatch()
        flashPulses(1)
        Haptics.success()
        after(0.9) {
            busy = false
            nameDraft = pet.species.name
            panel = .naming(isNew: true)
        }
    }

    func runEvolution() {
        busy = true
        let name = pet.displayName
        panel = .message(Message(title: "WHAT?", body: "\(name) is evolving!", actions: []))
        Haptics.tap()
        after(1.6) {
            panel = nil
            flashPulses(4)
        }
        // Swap the sprite while the screen is white.
        after(3.15) {
            let result = store.evolve()
            after(0.9) {
                busy = false
                Haptics.success()
                showMessage("CONGRATS!", "\(result.from) evolved into \(result.to)!", [("Yay!", {})])
            }
        }
    }

    func showFainted() {
        let name = pet.displayName
        Haptics.error()
        showMessage("OH NO!", "\(name) fainted from neglect...", [("Rush to the Pokémon Center", {
            store.revive()
            showMessage("ALL HEALED", "\(name) is back to health! Take good care of it.", [("OK", {})])
        })])
    }

    // MARK: - Actions

    /// Checks the pet can do something right now, explaining why not if it can't.
    func ready(needsAwake: Bool = true) -> Bool {
        if pet.phase == .egg {
            showToast("It's still an egg!")
            Haptics.error()
            return false
        }
        if pet.phase == .fainted {
            showFainted()
            return false
        }
        if needsAwake && pet.asleep {
            showToast("Shh... it's sleeping")
            Haptics.error()
            return false
        }
        return !busy
    }

    func openStats() {
        guard pet.phase != .egg else { showToast("It's still an egg!"); return }
        Haptics.tap()
        panel = .stats(page: 0)
    }

    func openFeed() {
        guard ready() else { return }
        Haptics.tap()
        panel = .feed
    }

    func feed(_ food: Food) {
        panel = nil
        if let reason = store.refusal(for: food) {
            showToast(reason)
            Haptics.error()
            return
        }
        busy = true
        feeding = food
        bites = 0
        for i in 1...3 {
            after(0.45 * Double(i)) {
                bites = i
                bounce()
                Haptics.tap()
                if i == 3 {
                    feeding = nil
                    store.feed(food)
                    addFloater(food == .berry ? "😋" : "💖")
                    Haptics.success()
                    busy = false
                }
            }
        }
    }

    func startGame() {
        guard ready() else { return }
        guard pet.energy >= 15 else {
            showToast("Too tired to play")
            Haptics.error()
            return
        }
        Haptics.tap()
        game = GameState()
        panel = .game
    }

    func guess(_ direction: Int) {
        guard !game.locked else { return }
        let turnsRight = Bool.random()
        let win = (direction == 1) == turnsRight
        game.facingRight = turnsRight
        game.round += 1
        if win { game.wins += 1 }
        game.title = win ? "YES!" : "NOPE!"
        game.locked = true
        win ? Haptics.success() : Haptics.error()
        after(0.8) {
            if game.round >= 5 {
                let won = store.finishGame(wins: game.wins)
                if won { Haptics.success() }
                showMessage(won ? "YOU WIN!" : "GOOD GAME",
                            won ? "It had a blast! ♥♥" : "It still had fun playing with you.", [("OK", {})])
            } else {
                game.locked = false
                game.title = "WHICH WAY?"
                game.facingRight = false
            }
        }
    }

    func clean() {
        guard ready(needsAwake: false) else { return }
        guard pet.poops > 0 else {
            showToast("Already clean!")
            Haptics.error()
            return
        }
        busy = true
        Haptics.success()
        withAnimation(.easeIn(duration: 0.6)) { sweeping = true }
        after(0.65) {
            store.clean()
            sweeping = false
            busy = false
            showToast("Squeaky clean!")
        }
    }

    func heal() {
        guard ready(needsAwake: false) else { return }
        let result = store.heal()
        if result.ok {
            addFloater("✚")
            Haptics.success()
        } else {
            Haptics.error()
        }
        showToast(result.message)
    }

    func toggleSleep() {
        guard ready(needsAwake: false) else { return }
        let result = store.toggleSleep()
        result.ok ? Haptics.tap() : Haptics.error()
        showToast(result.message)
    }

    func petIt() {
        guard ready() else { return }
        if store.petIt() {
            addFloater("♥")
            bounce()
            Haptics.tap()
        }
    }

    func saveName() {
        store.rename(nameDraft)
        panel = nil
        Haptics.success()
    }

    func restore(_ result: Result<URL, Error>) {
        guard case .success(let url) = result else { return }
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        if let data = try? Data(contentsOf: url), store.restore(data) {
            panel = nil
            showToast("Backup restored")
            Haptics.success()
        } else {
            showToast("That isn't a PokéPet backup")
            Haptics.error()
        }
    }

    // MARK: - Effects

    /// Runs `work` on the main actor after a delay (used to sequence animations).
    func after(_ seconds: Double, _ work: @escaping @MainActor () -> Void) {
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            work()
        }
    }

    func showMessage(_ title: String, _ body: String, _ actions: [(String, () -> Void)]) {
        let buttons = actions.map { action in
            MessageAction(label: action.0) {
                panel = nil
                Haptics.tap()
                action.1()
            }
        }
        panel = .message(Message(title: title, body: body, actions: buttons))
    }

    func showToast(_ text: String) {
        let t = Toast(text: text)
        withAnimation(.easeOut(duration: 0.2)) { toast = t }
        after(1.8) {
            if toast == t { withAnimation(.easeIn(duration: 0.2)) { toast = nil } }
        }
    }

    func addFloater(_ text: String) {
        let floater = Floater(text: text)
        floaters.append(floater)
        after(1.5) {
            floaters.removeAll { $0.id == floater.id }
        }
    }

    func bounce() {
        withAnimation(.easeOut(duration: 0.15)) { jump = true }
        after(0.15) {
            withAnimation(.easeIn(duration: 0.15)) { jump = false }
        }
    }

    /// White flashes, as when hatching or evolving. The last one holds white briefly.
    func flashPulses(_ count: Int) {
        for i in 0..<count {
            let start = Double(i) * 0.45
            after(start) {
                withAnimation(.easeIn(duration: 0.15)) { flash = 0.95 }
            }
            after(start + 0.2) {
                withAnimation(.easeOut(duration: 0.2)) { flash = i == count - 1 ? 0.95 : 0.2 }
            }
        }
        after(Double(count) * 0.45 + 0.3) {
            withAnimation(.easeOut(duration: 0.5)) { flash = 0 }
        }
    }
}
