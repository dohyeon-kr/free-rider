cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.14.0"
  sha256 arm:   "b8fe7ab6f49a60d0201314a979547720107f69921e9d03325cd864533f3d0234",
         intel: "ebea99bfb9a4a804783cc0e64722692e1050c569bf883d765091152118ccf4cf"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
