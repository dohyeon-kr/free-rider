cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.21.1"
  sha256 arm:   "d83f01b3860c3f5a9d148bcdfe073d487c18e76ef8dc44b18132ca87cc244caf",
         intel: "e382c3bc10e6e43ec36203e219c91eae6401e6fe2f17e275bc15860061c57460"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
