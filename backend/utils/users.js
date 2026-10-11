function publicUser(user) {
  return {
    id: user._id,
    fullName: user.fullName,
    mobileNumber: user.mobileNumber,
    townVillage: user.townVillage,
    tehsilTaluka: user.tehsilTaluka,
    district: user.district,
  }
}

module.exports = { publicUser }
