cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.11.1"
  sha256 arm:   "39bff1e7583a7fb945cb8484e37e3f76eb57a51da80a46c12887ecfff7af0e94",
         intel: "7a8dbf0d33feaacb956d20e919df20e3a4e522901d7bb845e49e158b4d0e923b"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
