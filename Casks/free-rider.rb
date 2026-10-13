cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.31.0"
  sha256 arm:   "e54e984fdcbd8472b2cd845e317714138c0b02492c18bd6e8997885a3962920b",
         intel: "35afe370c78e82290283ad26deb1c3e8172f0ee296f867e325336f338bf0cf21"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
