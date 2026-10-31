import ApplicationServices
import CoreGraphics
import Foundation

struct Request: Codable {
    let type: String
    let x: Double?
    let y: Double?
    let button: String?
    let deltaY: Double?
}

struct Response: Codable {
    let ok: Bool
    let error: String?
    let authorized: Bool?
}

var dragging = false
let decoder = JSONDecoder()
let encoder = JSONEncoder()

func respond(_ response: Response) {
    guard let data = try? encoder.encode(response), let line = String(data: data, encoding: .utf8) else { return }
    FileHandle.standardOutput.write(Data((line + "\n").utf8))
}

func currentLocation() -> CGPoint {
    CGEvent(source: nil)?.location ?? .zero
}

func postClick(button: CGMouseButton, down: CGEventType, up: CGEventType) {
    let location = currentLocation()
    CGEvent(mouseEventSource: nil, mouseType: down, mouseCursorPosition: location, mouseButton: button)?.post(tap: .cghidEventTap)
    CGEvent(mouseEventSource: nil, mouseType: up, mouseCursorPosition: location, mouseButton: button)?.post(tap: .cghidEventTap)
}

func handle(_ request: Request) -> Response {
    if request.type == "authorized" {
        return Response(ok: true, error: nil, authorized: AXIsProcessTrusted())
    }
    guard AXIsProcessTrusted() else {
        return Response(ok: false, error: "EyeMouse does not have macOS Accessibility permission.", authorized: false)
    }

    switch request.type {
    case "move":
        guard let x = request.x, let y = request.y else { return Response(ok: false, error: "Move requires x and y.", authorized: true) }
        let result = CGWarpMouseCursorPosition(CGPoint(x: x, y: y))
        return Response(ok: result == .success, error: result == .success ? nil : "Could not move the cursor.", authorized: true)
    case "click":
        let button = request.button == "right" ? CGMouseButton.right : CGMouseButton.left
        let down: CGEventType = button == .right ? .rightMouseDown : .leftMouseDown
        let up: CGEventType = button == .right ? .rightMouseUp : .leftMouseUp
        postClick(button: button, down: down, up: up)
        return Response(ok: true, error: nil, authorized: true)
    case "doubleClick":
        postClick(button: .left, down: .leftMouseDown, up: .leftMouseUp)
        postClick(button: .left, down: .leftMouseDown, up: .leftMouseUp)
        return Response(ok: true, error: nil, authorized: true)
    case "scroll":
        let amount = Int32(request.deltaY ?? 0)
        CGEvent(scrollWheelEvent2Source: nil, units: .line, wheelCount: 1, wheel1: amount, wheel2: 0, wheel3: 0)?.post(tap: .cghidEventTap)
        return Response(ok: true, error: nil, authorized: true)
    case "dragStart":
        let location = currentLocation()
        CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: location, mouseButton: .left)?.post(tap: .cghidEventTap)
        dragging = true
        return Response(ok: true, error: nil, authorized: true)
    case "dragEnd":
        let location = currentLocation()
        CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: location, mouseButton: .left)?.post(tap: .cghidEventTap)
        dragging = false
        return Response(ok: true, error: nil, authorized: true)
    default:
        return Response(ok: false, error: "Unknown input command.", authorized: true)
    }
}

while let line = readLine() {
    guard let data = line.data(using: .utf8), let request = try? decoder.decode(Request.self, from: data) else {
        respond(Response(ok: false, error: "Invalid request.", authorized: nil))
        continue
    }
    respond(handle(request))
}
