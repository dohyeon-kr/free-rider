cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.4.5"
  sha256 arm:   "75d891d4311804be1c3d712a12e152bb288576fbd28d3a8faadba5ea1ac5f891",
         intel: "14e79afb2458e896fc1f8e57282b1f5f54bdfa95cb5d040d2aff5215fec83d9c"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
