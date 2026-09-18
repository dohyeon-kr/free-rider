cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.19.0"
  sha256 arm:   "5822e84c4c7fd39b5a67d811d6b1b4569c15c9d16f8fbc39b49b418acf0aa779",
         intel: "02c1eb7fcb03fd17611f0b39ac9108257ec5fb9b8763c80ad10cf4751a82e6f0"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
