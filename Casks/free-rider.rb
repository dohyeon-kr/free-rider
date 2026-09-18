cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.23.0"
  sha256 arm:   "18a53db9676c5f58d2519751a224f3fad949755d842c4aee0cad97c7712deff8",
         intel: "e923627606897c77286a1cc9d2443d1517cc52d557ca1243ebeb0b461335a240"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
