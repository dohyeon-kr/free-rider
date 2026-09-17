cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.15.1"
  sha256 arm:   "fe956a0c31cc110eea77b667882d0bc00e5804e96b4b6112729c81351a1c1e47",
         intel: "17985fc3603ca90130d422102f58df5d6c04d1d6e83dbc06232d67634f58f689"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
