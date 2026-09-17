cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.13.0"
  sha256 arm:   "8a9794ff06dfdc8fa889a0d694eba70188b01a55afbed64d8088d4fb86d4f031",
         intel: "21fd0bedc0887ff54f11bb6dd1ac772a3b14d2af4a888dd44c3cf7fa294b952e"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
