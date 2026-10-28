import ImageIO
import SwiftUI
import UIKit

/// An animated sprite's frames and timing.
struct Sprite {
    let frames: [UIImage]
    /// When each frame ends, in seconds from the start of the loop.
    let frameEnds: [Double]

    var size: CGSize { frames[0].size }
    var duration: Double { frameEnds.last ?? 1 }

    func frame(at date: Date) -> UIImage {
        let t = date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: duration)
        let index = frameEnds.firstIndex { $0 > t } ?? frames.count - 1
        return frames[index]
    }
}

/// Loads the bundled animated GIF sprites once and keeps them in memory.
final class SpriteCache {
    static let shared = SpriteCache()
    private var cache: [Int: Sprite] = [:]

    func sprite(dex: Int) -> Sprite? {
        if let cached = cache[dex] { return cached }
        let url = Bundle.main.url(forResource: "\(dex)", withExtension: "gif")
            ?? Bundle.main.url(forResource: "\(dex)", withExtension: "gif", subdirectory: "Sprites")
        guard let url, let data = try? Data(contentsOf: url),
              let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }

        var frames: [UIImage] = []
        var ends: [Double] = []
        var elapsed = 0.0
        for i in 0..<CGImageSourceGetCount(source) {
            guard let frame = CGImageSourceCreateImageAtIndex(source, i, nil) else { continue }
            var delay = 0.1
            if let props = CGImageSourceCopyPropertiesAtIndex(source, i, nil) as? [CFString: Any],
               let gif = props[kCGImagePropertyGIFDictionary] as? [CFString: Any] {
                let d = (gif[kCGImagePropertyGIFUnclampedDelayTime] as? Double)
                    ?? (gif[kCGImagePropertyGIFDelayTime] as? Double) ?? 0.1
                if d > 0.011 { delay = d }
            }
            elapsed += delay
            frames.append(UIImage(cgImage: frame))
            ends.append(elapsed)
        }
        guard !frames.isEmpty else { return nil }
        let sprite = Sprite(frames: frames, frameEnds: ends)
        cache[dex] = sprite
        return sprite
    }
}

/// A Pokémon sprite, animated and scaled up with crisp pixels.
struct PixelSprite: View {
    let dex: Int
    let scale: CGFloat

    var body: some View {
        if let sprite = SpriteCache.shared.sprite(dex: dex) {
            TimelineView(.animation(minimumInterval: 1.0 / 30, paused: false)) { context in
                Image(uiImage: sprite.frame(at: context.date))
                    .resizable()
                    .interpolation(.none)
                    .frame(width: sprite.size.width * scale, height: sprite.size.height * scale)
            }
        } else {
            Text("?").font(.system(size: 40, weight: .black, design: .monospaced))
        }
    }
}
