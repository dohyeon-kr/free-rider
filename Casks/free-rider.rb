cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.17.1"
  sha256 arm:   "b0b2ae6ebff265780466b0d99536af6d1acfff8fdeecc8d03f7ecc27449c94f4",
         intel: "a9838b365dfdef3e97fbba6aabcb45d2d9d97fae6de1f3109314ad6d3b92c536"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
