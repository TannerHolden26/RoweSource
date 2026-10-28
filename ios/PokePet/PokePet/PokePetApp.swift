import SwiftUI

@main
struct PokePetApp: App {
    @StateObject private var store = PetStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .preferredColorScheme(.dark)
        }
    }
}
