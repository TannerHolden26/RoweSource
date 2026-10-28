import SwiftUI

/// The pages that open on top of the LCD: stats, feeding, the mini-game, naming and messages.
extension ContentView {
    func panelView(_ panel: Panel) -> some View {
        Group {
            switch panel {
            case .stats(let page): statsPanel(page: page)
            case .feed: feedPanel
            case .game: gamePanel
            case .naming(let isNew): namingPanel(isNew: isNew)
            case .message(let message): messagePanel(message)
            }
        }
        .foregroundStyle(Theme.ink)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Theme.lcd)
    }

    func panelTitle(_ text: String) -> some View {
        Text(text)
            .font(Theme.mono(13, .heavy))
            .tracking(1)
            .frame(maxWidth: .infinity)
    }

    // MARK: Stats

    func statsPanel(page: Int) -> some View {
        VStack(spacing: 6) {
            switch page {
            case 0:
                panelTitle(pet.displayName.uppercased())
                statRow("Hunger") { hearts(pet.hunger) }
                statRow("Happy") { hearts(pet.happy) }
                statRow("Energy") { bar(pet.energy) }
                statRow("Health") { bar(pet.health) }
                statRow("Friendship") { bar(pet.friendship) }
            case 1:
                panelTitle("PROFILE")
                statRow("Species") { Text(pet.species.name) }
                statRow("Age") { Text("\(Int(pet.ageHours / 24))d \(Int(pet.ageHours) % 24)h") }
                statRow("Weight") { Text("\(pet.weight) lb") }
                statRow("Status") { Text(status) }
                Text(evolutionHint)
                    .font(Theme.mono(10, .medium))
                    .frame(maxWidth: .infinity, alignment: .leading)
            default:
                panelTitle("OPTIONS")
                optionsList
            }
            Spacer(minLength: 0)
            HStack(spacing: 6) {
                Button("◀") { panel = .stats(page: (page + 2) % 3) }.frame(width: 44)
                Button("Back") { panel = nil }
                Button("▶") { panel = .stats(page: (page + 1) % 3) }.frame(width: 44)
            }
            .buttonStyle(LCDButtonStyle(centered: true))
        }
    }

    var status: String {
        if pet.daycare { return "Daycare" }
        if pet.sick { return "Sick" }
        if pet.asleep { return "Asleep" }
        return "OK"
    }

    var evolutionHint: String {
        guard pet.stage < Rules.evolve.count else { return "Fully evolved!" }
        let hours = Int(Rules.evolve[pet.stage].hours)
        return "Evolves after \(hours)h with lots of love"
    }

    var optionsList: some View {
        ScrollView {
            VStack(spacing: 6) {
                Button(pet.notifications ? "Reminders: On" : "Reminders: Off") {
                    store.setNotifications(!pet.notifications)
                    Haptics.tap()
                }
                Button {
                    store.setDaycare(!pet.daycare)
                    showToast(pet.daycare ? "Off to daycare!" : "Welcome home!")
                    Haptics.tap()
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(pet.daycare ? "Daycare: On" : "Daycare: Off")
                        Text("Needs drain 10x slower and it can't get sick. Use it when you'll be away.")
                            .font(Theme.mono(9, .medium))
                    }
                }
                Button("Rename") {
                    nameDraft = pet.displayName
                    panel = .naming(isNew: false)
                }
                Button("Back up to Files") { exporting = true }
                Button("Restore a backup") { importing = true }
                Button("Release & get a new egg") {
                    showMessage("RELEASE?", "Say goodbye to \(pet.displayName) and start over with a new egg?", [
                        ("Yes, release", { store.release(); showToast("A new egg!") }),
                        ("No", {}),
                    ])
                }
            }
            .buttonStyle(LCDButtonStyle())
        }
    }

    func statRow<Value: View>(_ label: String, @ViewBuilder value: () -> Value) -> some View {
        HStack {
            Text(label)
            Spacer()
            value()
        }
        .font(Theme.mono(12))
    }

    func hearts(_ value: Double) -> some View {
        let filled = Int((value / 25).rounded(.up))
        return HStack(spacing: 1) {
            ForEach(0..<4, id: \.self) { i in
                Text("♥").foregroundStyle(i < filled ? Theme.alert : Color(hex: 0xb9c0a8))
            }
        }
        .font(Theme.mono(13))
    }

    func bar(_ value: Double) -> some View {
        GeometryReader { geo in
            Rectangle()
                .fill(Theme.ink)
                .frame(width: geo.size.width * CGFloat(value / 100))
        }
        .frame(width: 90, height: 10)
        .clipShape(RoundedRectangle(cornerRadius: 3))
        .overlay(RoundedRectangle(cornerRadius: 3).stroke(Theme.ink, lineWidth: 2))
    }

    // MARK: Feed

    var feedPanel: some View {
        VStack(spacing: 6) {
            panelTitle("FEED")
            Button { feed(.berry) } label: {
                VStack(alignment: .leading, spacing: 2) {
                    Text("🫐 Oran Berry")
                    Text("Fills its tummy").font(Theme.mono(10, .medium))
                }
            }
            Button { feed(.puff) } label: {
                VStack(alignment: .leading, spacing: 2) {
                    Text("🧁 Poké Puff")
                    Text("A sweet treat that makes it happy").font(Theme.mono(10, .medium))
                }
            }
            Spacer(minLength: 0)
            Button("Back") { panel = nil }.buttonStyle(LCDButtonStyle(centered: true))
        }
        .buttonStyle(LCDButtonStyle())
    }

    // MARK: Mini-game

    var gamePanel: some View {
        VStack(spacing: 6) {
            panelTitle(game.title)
            Text(gameScore).font(Theme.mono(11))
            Spacer(minLength: 0)
            PixelSprite(dex: pet.species.dex, scale: 1.6)
                .scaleEffect(x: game.facingRight ? -1 : 1, y: 1)
                .animation(.easeOut(duration: 0.15), value: game.facingRight)
            Spacer(minLength: 0)
            HStack(spacing: 10) {
                Button("◀") { guess(-1) }
                Button("▶") { guess(1) }
            }
            .buttonStyle(LCDButtonStyle(centered: true, size: 18))
        }
    }

    var gameScore: String {
        let stars = String(repeating: "★", count: game.wins) + String(repeating: "☆", count: game.round - game.wins)
        return "Round \(min(game.round + 1, 5))/5  \(stars)"
    }

    // MARK: Naming

    func namingPanel(isNew: Bool) -> some View {
        VStack(spacing: 8) {
            panelTitle(isNew ? "IT HATCHED!" : "RENAME")
            if isNew {
                Text("It's a \(pet.species.name)!").font(Theme.mono(12))
            }
            Text("Give it a nickname:").font(Theme.mono(12))
            TextField("Nickname", text: $nameDraft)
                .font(Theme.mono(16))
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .submitLabel(.done)
                .onSubmit(saveName)
                .padding(6)
                .background(RoundedRectangle(cornerRadius: 6).fill(Color(hex: 0xf6f9ee)))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.ink, lineWidth: 2))
            Spacer(minLength: 0)
            Button("OK", action: saveName).buttonStyle(LCDButtonStyle(centered: true))
        }
    }

    // MARK: Messages

    func messagePanel(_ message: Message) -> some View {
        VStack(spacing: 8) {
            panelTitle(message.title)
            Text(message.body)
                .font(Theme.mono(12))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            ForEach(message.actions) { action in
                Button(action.label, action: action.run)
            }
            .buttonStyle(LCDButtonStyle(centered: true))
        }
    }
}
