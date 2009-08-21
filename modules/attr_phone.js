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

EXPORTED_SYMBOLS = [''];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://app/modules/gloda/log4moz.js");
Cu.import("resource://app/modules/StringBundle.js");

Cu.import("resource://app/modules/gloda/public.js");

Cu.import("resource://gpphone/modules/noun_phone.js");


const EXT_NAME = "gp-phone";

let PhoneAttr = {
  providerName: EXT_NAME,
  strings: new StringBundle("chrome://gpphone/locale/gpphone.properties"),
  _log: null,
  _numberRegex: null,

  init: function PhoneAttr_init() {
    this._log =  Log4Moz.repository.getLogger("gpphone.attr_phone");
    this._numberRegex = new RegExp(
      "\\b(?:(?:\\+?(\\d{1,3})[- .])?" + // country code, delimiter...
         "\\(?(\\d{3})[-./)]? {0,2})?" + // area code, delimeter...
      "([2-9][0-9]{2})[-. ]([0-9]{4})" + // phone number proper
      "(?:(?: {1,2}|[xX]|(?:[eE][xX][tT]\\.?)){1,2}(\\d{1,6}))?\\b", // extension
      "g");
    this.defineAttributes();
  },

  defineAttributes: function PhoneAttr_defineAttributes() {
    this._attrPhone = Gloda.defineAttribute({
      provider: this,
      extensionName: EXT_NAME,
      attributeType: Gloda.kAttrDerived,
      attributeName: "phoneNumber",
      bindName: "phoneNumbers",
      singular: false,
      facet: true,
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.lookupNoun("phone-number"),
      parameterNoun: null,
      });

    Gloda.defineNounAction(Gloda.lookupNoun("phone-number"), {
      actionType: "filter", actionTarget: Gloda.NOUN_MESSAGE,
      shortName: "same number",
      makeConstraint: function(aAttrDef, aPhoneNumber) {
        return [PhoneAttr._attrPhone].concat(
                PhoneNoun.toParamAndValue(aPhoneNumber));
      },
      });
    Gloda.defineNounAction(Gloda.lookupNoun("phone-number"), {
      actionType: "filter", actionTarget: Gloda.NOUN_MESSAGE,
      shortName: "same area code",
      makeConstraint: function(aAttrDef, aPhoneNumber) {
        return [PhoneAttr._attrPhone, null,
              PhoneNoun.toParamAndValue(aPhoneNumber.getAreaCodeLowerBound())[1],
              PhoneNoun.toParamAndValue(aPhoneNumber.getAreaCodeUpperBound())[1]];
      },
      });
  },

  process: function gp_phone_attr_process(aGlodaMessage, aRaw, aIsNew,
                                          aCallbackHandler) {
    let aMimeMsg = aRaw.mime;
    let seenNumbers = {};
    let phoneNumbers = [];
    if (aMimeMsg !== null) {
      let match;
      while ((match = this._numberRegex.exec(aMimeMsg.body)) !== null) {
        let countryCode = match[1] ? parseInt(match[1]) : 1;
        // so, in the past, you could omit the area code... so I guess let's
        //  support it, but just play dumb/impossible about it.
        let areaCode = match[2] ? parseInt(match[2]) : 0;
        let mainNumber = parseInt(match[3] + match[4]);
        let extension = match[5] ? parseInt(match[5]) : 0;

        let phoneObj = new PhoneNumber(countryCode, areaCode, mainNumber,
                                       extension);

        let numberStr = phoneObj.toString();
        if (!(numberStr in seenNumbers)) {
          seenNumbers[numberStr] = true;
          phoneNumbers.push(phoneObj);
        }
      }
    }

    if (phoneNumbers.length)
      aGlodaMessage.phoneNumbers = phoneNumbers;

    yield Gloda.kWorkDone;
  },
};

PhoneAttr.init();
