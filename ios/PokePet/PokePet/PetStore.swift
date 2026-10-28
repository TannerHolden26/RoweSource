import Foundation
import UserNotifications

/// Owns the pet: loads and saves it, applies actions, and schedules reminder notifications.
@MainActor
final class PetStore: ObservableObject {
    @Published var pet: Pet

    private let saveURL: URL

    init() {
        let dir = (try? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                                 appropriateFor: nil, create: true))
            ?? FileManager.default.temporaryDirectory
        saveURL = dir.appendingPathComponent("pet.json")
        if let data = try? Data(contentsOf: saveURL), let saved = try? Pet.decodeMerging(data) {
            pet = saved
        } else {
            pet = Pet()
        }
    }

    // MARK: Saving

    func save() {
        if let data = try? JSONEncoder().encode(pet) {
            try? data.write(to: saveURL, options: .atomic)
        }
    }

    /// Something changed: save it and re-plan the reminders.
    private func commit() {
        save()
        scheduleNotifications()
    }

    func tick() {
        pet.simulate()
        save()
    }

    var readyToHatch: Bool {
        pet.phase == .egg && Date().timeIntervalSince(pet.created) >= Rules.hatchSeconds
    }

    // MARK: Actions

    func hatch() {
        pet.phase = .alive
        pet.hatchedAt = Date()
        pet.last = Date()
        commit()
        requestNotificationPermission()
    }

    /// Why it won't eat right now, or nil if it will.
    func refusal(for food: Food) -> String? {
        switch food {
        case .berry: return pet.hunger >= 95 ? "It's full!" : nil
        case .puff: return pet.happy >= 100 ? "It doesn't want any" : nil
        }
    }

    func feed(_ food: Food) {
        switch food {
        case .berry:
            if pet.hunger < 25 { pet.friendship = clamp100(pet.friendship + 2) }
            pet.hunger = clamp100(pet.hunger + 30)
            pet.weight += 1
            pet.health = clamp100(pet.health + 3)
        case .puff:
            pet.happy = clamp100(pet.happy + 22)
            pet.hunger = clamp100(pet.hunger + 6)
            pet.weight += 2
        }
        commit()
    }

    func clean() {
        pet.poops = 0
        pet.poopTimer = 0
        pet.friendship = clamp100(pet.friendship + 1)
        commit()
    }

    func heal() -> (ok: Bool, message: String) {
        guard pet.sick else { return (false, "It's not sick!") }
        pet.sick = false
        pet.happy = clamp100(pet.happy - 5)
        pet.health = clamp100(pet.health + 10)
        commit()
        return (true, "All better!")
    }

    func toggleSleep() -> (ok: Bool, message: String) {
        if pet.asleep {
            pet.asleep = false
            commit()
            if pet.energy < 50 {
                pet.happy = clamp100(pet.happy - 8)
                save()
                return (false, "It woke up grumpy...")
            }
            return (true, "Good morning!")
        }
        guard pet.energy <= 85 else { return (false, "It's not sleepy") }
        pet.asleep = true
        commit()
        return (true, "Good night...")
    }

    /// Returns true if the petting counted (there's a short cooldown).
    func petIt() -> Bool {
        let now = Date()
        guard now.timeIntervalSince(pet.lastPet) >= 3 else { return false }
        pet.lastPet = now
        let hour = Int(now.timeIntervalSince1970 / 3600)
        if pet.petHour != hour {
            pet.petHour = hour
            pet.petsThisHour = 0
        }
        pet.petsThisHour += 1
        pet.happy = clamp100(pet.happy + 3)
        if pet.petsThisHour <= 5 { pet.friendship = clamp100(pet.friendship + 0.5) }
        commit()
        return true
    }

    /// Applies the result of a 5-round game. Returns true if it was a win.
    func finishGame(wins: Int) -> Bool {
        let won = wins >= 3
        pet.happy = clamp100(pet.happy + (won ? 30 : 12))
        pet.friendship = clamp100(pet.friendship + (won ? 4 : 1))
        pet.energy = clamp100(pet.energy - 8)
        pet.hunger = clamp100(pet.hunger - 5)
        pet.weight = max(1, pet.weight - 1)
        commit()
        return won
    }

    func rename(_ name: String) {
        let trimmed = String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(10))
        pet.name = trimmed.isEmpty ? pet.species.name : trimmed
        commit()
    }

    /// Evolves to the next stage. Returns the old and new species names.
    func evolve() -> (from: String, to: String) {
        let from = pet.species.name
        if pet.stage + 1 < Species.lines[pet.line].count { pet.stage += 1 }
        pet.pendingEvolution = false
        pet.happy = clamp100(pet.happy + 20)
        if pet.name == from { pet.name = pet.species.name }
        commit()
        return (from, pet.species.name)
    }

    /// Pokémon Center: back to health, but it trusts you a little less.
    func revive() {
        pet.phase = .alive
        pet.health = 60
        pet.hunger = 60
        pet.happy = 40
        pet.energy = 80
        pet.sick = false
        pet.poops = 0
        pet.friendship = clamp100(pet.friendship - 15)
        pet.last = Date()
        commit()
    }

    func release() {
        let notifications = pet.notifications
        pet = Pet()
        pet.notifications = notifications
        commit()
    }

    func setDaycare(_ on: Bool) {
        pet.simulate()
        pet.daycare = on
        commit()
    }

    func setNotifications(_ on: Bool) {
        pet.notifications = on
        if on { requestNotificationPermission() }
        commit()
    }

    // MARK: Backup

    func backupData() -> Data {
        (try? JSONEncoder().encode(pet)) ?? Data()
    }

    func restore(_ data: Data) -> Bool {
        guard let restored = try? Pet.decodeMerging(data) else { return false }
        pet = restored
        pet.simulate()
        commit()
        return true
    }

    // MARK: Notifications

    func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    /// Plans a reminder for when each need will next run low, assuming nobody opens the app.
    func scheduleNotifications() {
        let center = UNUserNotificationCenter.current()
        center.removeAllPendingNotificationRequests()
        guard pet.phase == .alive, pet.notifications else { return }

        let name = pet.displayName
        let care = pet.daycare ? Rules.daycareFactor : 1
        let drain = (pet.asleep ? Rules.sleepFactor : 1) * care
        var alerts: [(id: String, minutes: Double, text: String)] = []

        if pet.hunger > 25 {
            alerts.append(("hungry", (pet.hunger - 25) / (Rules.hungerPerMin * drain), "\(name) is hungry! Time for an Oran Berry."))
        }
        if pet.hunger > 0 {
            alerts.append(("starving", pet.hunger / (Rules.hungerPerMin * drain), "\(name) is starving and its health is dropping!"))
        }
        if pet.happy > 25 {
            alerts.append(("bored", (pet.happy - 25) / (Rules.happyPerMin * drain), "\(name) is bored and wants to play!"))
        }
        if !pet.asleep && !pet.daycare && pet.poops < 2 {
            let minutes = Double(Rules.poopEvery - pet.poopTimer + (1 - pet.poops) * Rules.poopEvery)
            alerts.append(("dirty", minutes, "\(name) made a mess. Time to clean up!"))
        }
        if !pet.asleep && pet.energy > 20 {
            alerts.append(("sleepy", (pet.energy - 20) / (Rules.energyPerMin * care), "\(name) is getting sleepy."))
        }

        for alert in alerts where alert.minutes >= 1 {
            let content = UNMutableNotificationContent()
            content.title = "PokéPet"
            content.body = alert.text
            content.sound = .default
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: alert.minutes * 60, repeats: false)
            center.add(UNNotificationRequest(identifier: alert.id, content: content, trigger: trigger))
        }
    }
}
