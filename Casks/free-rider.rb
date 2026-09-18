cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.23.1"
  sha256 arm:   "fcfb59d6b184f6ad17401fae7ddb941aed248275186c5c3d5d0e36025e523eb9",
         intel: "6ac34291816a7f674a87a24da2ea8c097f44cb028679e93c4d474825655b24a2"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
