cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.16.0"
  sha256 arm:   "8d7325c18cb34aede9a9679f1604f0380e2b9cb28407150ba09e9f6b0053cb09",
         intel: "1ae85364fe7a8deb303a2239a0d4208ee82904f9668005364fcfb3d9e20a1ff9"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
