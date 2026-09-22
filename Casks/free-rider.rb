cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.26.0"
  sha256 arm:   "b683654166999f04e50a2d7f0c6540899e0ed38751d4b47b82c4c10bd3f50a5a",
         intel: "df9dcaa36ac51be7d5f17bbd273da07667a13a1ceb8357399492dc211ebd1c1b"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
