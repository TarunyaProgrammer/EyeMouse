import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let size = 1024
let colorSpace = CGColorSpaceCreateDeviceRGB()
let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: size * 4, space: colorSpace, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
let bounds = CGRect(x: 0, y: 0, width: size, height: size)
context.setFillColor(CGColor(red: 0.082, green: 0.086, blue: 0.102, alpha: 1))
context.addPath(CGPath(roundedRect: bounds.insetBy(dx: 18, dy: 18), cornerWidth: 224, cornerHeight: 224, transform: nil))
context.fillPath()

let eye = CGMutablePath()
eye.move(to: CGPoint(x: 128, y: 512))
eye.addCurve(to: CGPoint(x: 896, y: 512), control1: CGPoint(x: 240, y: 280), control2: CGPoint(x: 784, y: 280))
eye.addCurve(to: CGPoint(x: 128, y: 512), control1: CGPoint(x: 784, y: 744), control2: CGPoint(x: 240, y: 744))
context.setStrokeColor(CGColor(red: 0.957, green: 0.961, blue: 0.969, alpha: 1))
context.setLineWidth(52)
context.setLineJoin(.round)
context.addPath(eye)
context.strokePath()

context.setFillColor(CGColor(red: 0.467, green: 0.655, blue: 1, alpha: 1))
context.fillEllipse(in: CGRect(x: 396, y: 396, width: 232, height: 232))
context.setFillColor(CGColor(red: 0.082, green: 0.086, blue: 0.102, alpha: 1))
context.fillEllipse(in: CGRect(x: 470, y: 470, width: 84, height: 84))

let output = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "assets/icon-1024.png")
let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(destination, context.makeImage()!, nil)
guard CGImageDestinationFinalize(destination) else { fatalError("Could not write icon") }
