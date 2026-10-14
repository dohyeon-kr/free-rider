cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.32.1"
  sha256 arm:   "0618f79aa2665643b9279eea52a49c2d484be9757996c28847bbeb3f93ca4a1e",
         intel: "4d8c484818cac6663e5542aef342edf1dc4b96797dd0cd2d472ff73f0de77d96"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
