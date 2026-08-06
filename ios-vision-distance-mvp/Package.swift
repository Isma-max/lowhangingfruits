// swift-tools-version:5.10
import PackageDescription

let package = Package(
    name: "VisionMVPCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "VisionMVPCore", targets: ["VisionMVPCore"])
    ],
    targets: [
        .target(name: "VisionMVPCore"),
        .testTarget(name: "VisionMVPCoreTests", dependencies: ["VisionMVPCore"])
    ]
)
