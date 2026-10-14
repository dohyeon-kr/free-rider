cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.33.0"
  sha256 arm:   "b84f3b034ef6451edeed90381e99253bef4d240c83f42bbda4f714410616975e",
         intel: "c5126c664f2ac740a654749300fc2d33d9e2de0a4d24d2d857d6b4b9b063971e"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
