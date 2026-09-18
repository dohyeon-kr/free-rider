cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.18.0"
  sha256 arm:   "3f5c22f260b3d89d04778b51d5a02a0da02a7fe635c8df4a8e6e3d8c6b5078ae",
         intel: "e7ad39cbeb6750f5b2eb9361ed216f1462c7d09d892de1e12d5ba7cf358ce636"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
