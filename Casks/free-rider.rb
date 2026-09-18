cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.22.0"
  sha256 arm:   "3e3dd3ca909c2c912b232596913c97d2d4aac5d0bdf978f7cb326175287175b3",
         intel: "09b0c24b8d7d54c051ebaf4e9438010113b8c270a6080b627c6bb2e005ae9041"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
