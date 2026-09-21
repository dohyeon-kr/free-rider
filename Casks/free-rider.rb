cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.24.0"
  sha256 arm:   "530e928bf8a01d1b9ea052fcc1f008a103bba02dd25e69037e0e8c9aebc03c76",
         intel: "4cf65f15f22139434a49e678f2c1fa684dc4f4e930a7b9178703f4ffaefc28eb"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
