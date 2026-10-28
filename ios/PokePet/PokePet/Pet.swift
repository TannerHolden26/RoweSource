import Foundation

// MARK: - Species

struct Species: Hashable {
    let dex: Int
    let name: String

    /// Each egg hatches into one of these evolution lines. Sprites are bundled as Sprites/<dex>.gif.
    static let lines: [[Species]] = [
        [Species(dex: 172, name: "Pichu"), Species(dex: 25, name: "Pikachu"), Species(dex: 26, name: "Raichu")],
        [Species(dex: 155, name: "Cyndaquil"), Species(dex: 156, name: "Quilava"), Species(dex: 157, name: "Typhlosion")],
        [Species(dex: 158, name: "Totodile"), Species(dex: 159, name: "Croconaw"), Species(dex: 160, name: "Feraligatr")],
        [Species(dex: 152, name: "Chikorita"), Species(dex: 153, name: "Bayleef"), Species(dex: 154, name: "Meganium")],
    ]
}

// MARK: - Tuning

enum Rules {
    // Per minute of real time.
    static let hungerPerMin = 100.0 / (7 * 60)     // empty after ~7 hours awake
    static let happyPerMin = 100.0 / (9 * 60)      // bored after ~9 hours
    static let energyPerMin = 100.0 / (16 * 60)    // tired after ~16 hours awake
    static let restPerMin = 100.0 / (7 * 60)       // fully rested after ~7 hours asleep
    static let sleepFactor = 0.3                   // needs drain slower while asleep
    static let daycareFactor = 0.1                 // and much slower at daycare
    static let poopEvery = 200                     // minutes awake between messes
    static let hatchSeconds = 60.0

    /// Hours of age and friendship needed to evolve from stage i to stage i + 1.
    static let evolve: [(hours: Double, friendship: Double)] = [(24, 50), (72, 70)]
}

func clamp100(_ v: Double) -> Double { min(100, max(0, v)) }

// MARK: - Pet

enum Phase: String, Codable { case egg, alive, fainted }

enum Need { case hungry, bored, dirty, sick, sleepy }

enum Food {
    case berry, puff

    var emoji: String { self == .berry ? "🫐" : "🧁" }
}

struct Pet: Codable {
    var phase: Phase = .egg
    var created = Date()
    var last = Date()
    var name = ""
    var line = Int.random(in: 0..<Species.lines.count)
    var stage = 0
    var hunger = 70.0
    var happy = 70.0
    var energy = 100.0
    var health = 100.0
    var friendship = 20.0
    var weight = 5
    var poops = 0
    var poopTimer = 0
    var sick = false
    var asleep = false
    var hatchedAt = Date()
    var pendingEvolution = false
    var lastPet = Date.distantPast
    var petsThisHour = 0
    var petHour = 0
    var daycare = false
    var notifications = true

    var species: Species { Species.lines[line][stage] }
    var displayName: String { name.isEmpty ? species.name : name }
    var ageHours: Double { max(0, Date().timeIntervalSince(hatchedAt) / 3600) }

    var needs: [Need] {
        guard phase == .alive else { return [] }
        var n: [Need] = []
        if hunger < 25 { n.append(.hungry) }
        if happy < 25 { n.append(.bored) }
        if poops >= 2 { n.append(.dirty) }
        if sick { n.append(.sick) }
        if energy < 20 && !asleep { n.append(.sleepy) }
        return n
    }

    /// Decodes a save, filling in defaults for any fields an older save doesn't have.
    static func decodeMerging(_ data: Data) throws -> Pet {
        let base = try JSONSerialization.jsonObject(with: JSONEncoder().encode(Pet())) as? [String: Any] ?? [:]
        guard let saved = try JSONSerialization.jsonObject(with: data) as? [String: Any], saved["phase"] != nil else {
            throw CocoaError(.fileReadCorruptFile)
        }
        let merged = base.merging(saved) { _, new in new }
        return try JSONDecoder().decode(Pet.self, from: JSONSerialization.data(withJSONObject: merged))
    }

    // MARK: Simulation

    /// Advances the pet minute by minute from the last update, so time passes while the app is closed.
    mutating func simulate(until now: Date = Date()) {
        guard phase == .alive else { last = now; return }
        let minutes = Int(now.timeIntervalSince(last) / 60)
        guard minutes > 0 else { return }
        let steps = min(minutes, 60 * 24 * 30) // catch up at most 30 days
        for _ in 0..<steps {
            last = last.addingTimeInterval(60)
            step()
            if phase != .alive { break }
        }
        if phase != .alive || minutes > steps { last = now }
    }

    private mutating func step() {
        let care = daycare ? Rules.daycareFactor : 1
        let f = (asleep ? Rules.sleepFactor : 1) * care
        hunger = clamp100(hunger - Rules.hungerPerMin * f)
        happy = clamp100(happy - Rules.happyPerMin * f)

        if asleep {
            energy = clamp100(energy + Rules.restPerMin)
            if energy >= 100 { asleep = false } // wakes up on its own
        } else {
            energy = clamp100(energy - Rules.energyPerMin * care)
            if energy <= 3 { asleep = true }     // dozes off when exhausted
            if !daycare {
                poopTimer += 1
                if poopTimer >= Rules.poopEvery {
                    poopTimer = 0
                    poops = min(4, poops + 1)
                }
            }
        }

        // Health: neglect hurts, good care slowly heals. Daycare keeps it safe.
        var dh = 0.0
        if hunger <= 0 { dh -= 0.12 }
        if poops >= 2 { dh -= 0.03 * Double(poops) }
        if sick { dh -= 0.1 }
        if dh == 0 && hunger > 30 { dh = 0.08 }
        if daycare { dh = max(dh, 0) }
        health = clamp100(health + dh)

        if !sick && !daycare && (hunger <= 0 || poops >= 3 || energy <= 0) && Double.random(in: 0..<1) < 1.0 / 240 {
            sick = true
        }
        if hunger <= 0 || happy <= 0 { friendship = clamp100(friendship - 0.01) }
        if hunger > 50 && happy > 50 && poops == 0 && !sick { friendship = clamp100(friendship + 0.004) }

        // Evolution, if old enough and well loved.
        if stage < Rules.evolve.count && !pendingEvolution {
            let need = Rules.evolve[stage]
            let ageH = last.timeIntervalSince(hatchedAt) / 3600
            if ageH >= need.hours && friendship >= need.friendship && health >= 50 { pendingEvolution = true }
        }

        if health <= 0 {
            phase = .fainted
            asleep = false
        }
    }
}
