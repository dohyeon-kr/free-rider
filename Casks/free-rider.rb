cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.21.0"
  sha256 arm:   "1c5d31c5e6b79fb9bfa7a0db990282acff33558b1b0a32fcc93b4f6258a752d5",
         intel: "b2e45992413c8f9024a08386ce6ff03411160fc732d7cae2c1afeee7640c853e"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
