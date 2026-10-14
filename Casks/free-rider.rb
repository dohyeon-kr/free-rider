cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.34.0"
  sha256 arm:   "66daa47094a4f76eaedcf536850a6d3c1ae7f3cdc73c670e30fbdcfac112506a",
         intel: "0fc8051623d2c25552b4d8b1230a48d7e9760e51c0729cba09fcfc0227a1016c"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
