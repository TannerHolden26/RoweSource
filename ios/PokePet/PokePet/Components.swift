import SwiftUI
import UIKit
import UniformTypeIdentifiers

// MARK: - Colors

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(.sRGB,
                  red: Double((hex >> 16) & 0xff) / 255,
                  green: Double((hex >> 8) & 0xff) / 255,
                  blue: Double(hex & 0xff) / 255,
                  opacity: opacity)
    }
}

enum Theme {
    static let shellLight = Color(hex: 0xffb347)
    static let shellDark = Color(hex: 0xf08a1c)
    static let shellEdge = Color(hex: 0xc9650b)
    static let lcd = Color(hex: 0xe9efd8)
    static let lcdNight = Color(hex: 0x4d5770)
    static let ink = Color(hex: 0x2b2a22)
    static let bezel = Color(hex: 0x3a3546)
    static let grassTop = Color(hex: 0xb9d48a)
    static let grassBottom = Color(hex: 0x9fc06f)
    static let alert = Color(hex: 0xd62828)

    static func mono(_ size: CGFloat, _ weight: Font.Weight = .bold) -> Font {
        .system(size: size, weight: weight, design: .monospaced)
    }
}

// MARK: - Haptics

enum Haptics {
    static func tap() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    static func error() { UINotificationFeedbackGenerator().notificationOccurred(.error) }
}

// MARK: - Shapes

/// The egg-shaped device body.
struct EggShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width, h = rect.height
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: rect.minX + x * w, y: rect.minY + y * h) }
        var p = Path()
        p.move(to: pt(0.5, 0))
        p.addCurve(to: pt(1, 0.58), control1: pt(0.9, 0), control2: pt(1, 0.3))
        p.addCurve(to: pt(0.5, 1), control1: pt(1, 0.86), control2: pt(0.8, 1))
        p.addCurve(to: pt(0, 0.58), control1: pt(0.2, 1), control2: pt(0, 0.86))
        p.addCurve(to: pt(0.5, 0), control1: pt(0, 0.3), control2: pt(0.1, 0))
        p.closeSubpath()
        return p
    }
}

/// The spotted Pokémon egg shown before hatching.
struct EggView: View {
    let cracked: Bool

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            ZStack {
                EggShape()
                    .fill(RadialGradient(colors: [.white, Color(hex: 0xe9e2cf)], center: UnitPoint(x: 0.35, y: 0.3),
                                         startRadius: 0, endRadius: w * 0.8))
                EggShape().stroke(Theme.ink, lineWidth: 3)
                Circle().fill(Color(hex: 0x7cc36b)).frame(width: w * 0.18).position(x: w * 0.32, y: h * 0.43)
                Circle().fill(Color(hex: 0xf2a541)).frame(width: w * 0.13).position(x: w * 0.66, y: h * 0.3)
                Circle().fill(Color(hex: 0x5aa9e6)).frame(width: w * 0.21).position(x: w * 0.68, y: h * 0.67)
                Circle().fill(Color(hex: 0xf2a541)).frame(width: w * 0.13).position(x: w * 0.34, y: h * 0.76)
                if cracked {
                    Path { p in
                        p.move(to: CGPoint(x: w * 0.18, y: h * 0.54))
                        for (i, x) in [0.32, 0.4, 0.53, 0.63, 0.76].enumerated() {
                            p.addLine(to: CGPoint(x: w * x, y: h * (i % 2 == 0 ? 0.48 : 0.56)))
                        }
                    }
                    .stroke(Theme.ink, lineWidth: 2.5)
                }
            }
        }
    }
}

// MARK: - Controls

/// A round device button around the screen.
struct IconButton: View {
    let symbol: String
    let label: String
    let attention: Bool
    let action: @MainActor () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Theme.ink)
                .symbolEffect(.pulse, isActive: attention)
                .frame(width: 50, height: 50)
                .background(
                    Circle().fill(RadialGradient(colors: attention ? [.white, Color(hex: 0xffd166)] : [Color(hex: 0xfffaf0), Color(hex: 0xffe4bf)],
                                                 center: UnitPoint(x: 0.5, y: 0.35), startRadius: 0, endRadius: 30))
                )
                .shadow(color: Theme.shellEdge, radius: 0, y: 3)
        }
        .buttonStyle(PressDownStyle())
        .accessibilityLabel(label)
    }
}

struct PressDownStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .offset(y: configuration.isPressed ? 2 : 0)
            .animation(.easeOut(duration: 0.08), value: configuration.isPressed)
    }
}

/// An outlined button drawn on the LCD.
struct LCDButtonStyle: ButtonStyle {
    var centered = false
    var size: CGFloat = 12

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.mono(size, .heavy))
            .multilineTextAlignment(centered ? .center : .leading)
            .frame(maxWidth: .infinity, alignment: centered ? .center : .leading)
            .padding(.vertical, 7)
            .padding(.horizontal, 8)
            .foregroundStyle(configuration.isPressed ? Theme.lcd : Theme.ink)
            .background(RoundedRectangle(cornerRadius: 8).fill(configuration.isPressed ? Theme.ink : Color.clear))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.ink, lineWidth: 2))
            .contentShape(Rectangle())
    }
}

// MARK: - LCD background

struct LCDBackground: View {
    let night: Bool

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottom) {
                Rectangle().fill(night ? Theme.lcdNight : Theme.lcd)
                Canvas { ctx, size in
                    var grid = Path()
                    stride(from: 0, to: size.width, by: 4).forEach { x in grid.addRect(CGRect(x: x, y: 0, width: 0.5, height: size.height)) }
                    stride(from: 0, to: size.height, by: 4).forEach { y in grid.addRect(CGRect(x: 0, y: y, width: size.width, height: 0.5)) }
                    ctx.fill(grid, with: .color(.black.opacity(0.05)))
                }
                LinearGradient(colors: [Theme.grassTop, Theme.grassBottom], startPoint: .top, endPoint: .bottom)
                    .frame(height: geo.size.height * 0.2)
                    .overlay(alignment: .top) { Rectangle().fill(Color(hex: 0x86a95a)).frame(height: 2) }
                    .brightness(night ? -0.35 : 0)
            }
        }
    }
}

// MARK: - Screen state

struct MessageAction: Identifiable {
    let id = UUID()
    let label: String
    let run: () -> Void
}

struct Message {
    var title: String
    var body: String
    var actions: [MessageAction]
}

enum Panel {
    case stats(page: Int)
    case feed
    case game
    case naming(isNew: Bool)
    case message(Message)
}

struct GameState {
    var round = 0
    var wins = 0
    var locked = false
    var facingRight = false
    var title = "WHICH WAY?"
}

struct Floater: Identifiable {
    let id = UUID()
    let text: String
    let start = Date()
}

struct Toast: Equatable {
    let id = UUID()
    let text: String
}

// MARK: - Backup file

struct BackupDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    var data: Data

    init(data: Data) { self.data = data }

    init(configuration: ReadConfiguration) throws {
        data = configuration.file.regularFileContents ?? Data()
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}
