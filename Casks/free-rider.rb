cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.32.0"
  sha256 arm:   "60faddac8bf7a7d30ed3b7e7a2e3d2d2c870f454d68895f3018b4f6f778d78f5",
         intel: "3928b52fdf55b1109a1eb2d1719573ef297d1e0b75711ded8ebfe43e703c80fa"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
