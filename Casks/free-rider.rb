cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.35.0"
  sha256 arm:   "b145a54df627e176e23fc19be30633774f2c3ebc6a6adf4e97f67df553925179",
         intel: "e48d2801049879c66a4b634d74583606677d9cf2fed920c5e65e57efab5fb1a6"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
