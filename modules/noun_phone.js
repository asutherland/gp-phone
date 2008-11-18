/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 * 
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is gp-phone.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Sutherland <asutherland@asutherland.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * 
 * ***** END LICENSE BLOCK ***** */

EXPORTED_SYMBOLS = ['PhoneNumber', 'PhoneNoun'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://app/modules/gloda/log4moz.js");
Cu.import("resource://app/modules/gloda/public.js")

/**
 * A phone number!  We're sorta trying to support phone numbers in multiple
 *  countries, but the reality is that for this, a first-pass demonstration
 *  plugin, we're not going to get there.
 *
 * @param aCountryCode The country code, 1 for North America (USA, Canada,
 *     friends in the NANP.)
 * @param aAreaCode The area code or whatever term describes the thing most
 *     close to an area code.  (For historical reasons, any phone system will
 *     probably something like an area code.)  In the USA/NANP this will be
 *     3 digits worth of fun.
 * @param aNumber The rest of the phone number that's not the extension.
 * @param aExtension The extension number.  It had better not be more than 6
 *     digits.
 */
function PhoneNumber(aCountryCode, aAreaCode, aNumber, aExtension) {
  this.countryCode = aCountryCode;
  this.areaCode = aAreaCode;
  this.number = aNumber;
  this.extension = aExtension ? aExtension : 0;
}

const ZEROES = "00000000000";

PhoneNumber.prototype = {
  /* these should be parameterized by country code in the future */
  areaCodeMaxDigits: 3,
  areaCodeShifter: 1000,
  numberMaxDigits: 7,
  numberShifter: 10000000,
  /* this can't particularly change */
  extensionDigits: 6,
  extensionShifter: 1000000,

  /* where do we split the number... assuming NANP formatting here. */
  numberSplit: 4, // from the right
  numberSplitShifter: 10000,
  
  /* helper ops.  given our extension plan, you need a PhoneNumber in the
   *  country already.  guess we could wrap this or not do it this way.
   */
  getCountryLowerBound: function () {
    return new PhoneNumber(this.countryCode, 0, 0, 0);
  },
  getCountryUpperBound: function () {
    return new PhoneNumber(this.countryCode, this.areaCodeShifter-1,
                           this.numberShifter-1, this.extensionShifter-1);
  },
  getAreaCodeLowerBound: function(aAreaCode) {
    if (!aAreaCode)
      aAreaCode = this.areaCode;
    return new PhoneNumber(this.countryCode, aAreaCode, 0, 0);
  },
  getAreaCodeUpperBound: function(aAreaCode) {
    if (!aAreaCode)
      aAreaCode = this.areaCode;
    return new PhoneNumber(this.countryCode, aAreaCode, this.numberShifter-1,
                           this.extensionShifter-1);
  },
  
  toString: function () {
    // we allow the area code to be zero when missing, so we need to zero-pad it
    //  too (or just special case zero, I suppose)
    let area = "" + this.areaCode;
    // legal numbers don't need zero-padding, but for cutters-and-pasters...
    let numHigh = "" + Math.floor(this.number / this.numberSplitShifter);
    let numLow = "" + (this.number % this.numberSplitShifter);
    
    let extensionStr;
    // we don't allow 0 as an extension or allow required zero padding.
    // luckily, PBX/historical constraints are on our side
    if (this.extension != 0)
      extensionStr = " x" + this.extension; 
    else
      extensionStr = "";
    
    return "+" + this.countryCode + " " +
           ZEROES.substring(0, 3 - area.length) + area + "-" +
           ZEROES.substring(0, 3 - numHigh.length) + numHigh + "-" +
           ZEROES.substring(0, 4 - numLow.length) + numLow +
           extensionStr;
  }
};

const COUNTRY_ABS_SHIFT = 10000000000000000;

/**
 * 
 *
 * Encoding:
 *
 * We can cram 19 digits worth of numbers into a signed 64-bit int.  Here we go:
 * - Country Code: 3 digits.  Even though these have a tree-like structure, we
 *   right-align them (zero pad to the left).
 * - 10 digits for the actual phone number.  It looks like all numbers can fit
 *   in 10 digits... the UK is 11 digits, but the first digit is always a zero,
 *   so good for them.  We'll arbitrarily right-align (zero pad to the left)
 *   countries with less than 10 digits, for example Denmark apparently uses 8.
 * - Extension: 6 digits.  I've actually received a 7-digit extension from Dell,
 *   but I say they went too far!
 */
let PhoneNoun = {
  name: "phone-number",
  class: PhoneNumber,
  allowsArbitraryAttrs: false,
  
  toParamAndValue: function gp_phone_noun_toParamAndValue(aPhoneNumber) {
    let aValue = aPhoneNumber.countryCode;
    aValue *= aPhoneNumber.areaCodeShifter;
    aValue += aPhoneNumber.areaCode;
    aValue *= aPhoneNumber.numberShifter;
    aValue += aPhoneNumber.number;
    aValue *= aPhoneNumber.extensionShifter;
    aValue += aPhoneNumber.extension;
    
    return [null, aValue];
  },
  
  fromParamAndValue: function gp_phone_noun_fromParamAndValue(aIgnoredParam,
                                                              aAttrVal) {
    let value = aAttrVal;
    let countryCode = Math.floor(value / COUNTRY_ABS_SHIFT);
    // assuming the shifts are actually computed on the fly...
    let phoneNumber = new PhoneNumber(countryCode, 0, 0, 0);
    let areaShift = Math.floor(COUNTRY_ABS_SHIFT / phoneNumber.areaCodeShifter);
    phoneNumber.areaCode = Math.floor(value / areaShift) %
                           phoneNumber.areaCodeShifter;
    let numberShift = Math.floor(areaShift / phoneNumber.numberShifter);
    phoneNumber.number = Math.floor(value / numberShift) %
                         phoneNumber.numberShifter;
    phoneNumber.extension = value % phoneNumber.extensionShifter;
     
    return phoneNumber;
  },
};

Gloda.defineNoun(PhoneNoun);
