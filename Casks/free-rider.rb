cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.26.1"
  sha256 arm:   "33f03ec2112754dd8c06bd62573e4e6f278c1227741f4fbb9b541de5a063528b",
         intel: "77c9db073d66d1ebe4145eafc25d6a04be62226c9cf677fb3d000936a208b1e4"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
