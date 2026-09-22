cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.25.0"
  sha256 arm:   "7c786f4bf8814c786ef7b8850d1c33736cfa2d93674bebf9bef5963c7b264405",
         intel: "16322874fe86159d1664d2680d4c744f46e30f442babdf390e914d9220776f8b"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
