define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster'),
		toastr = require('toastr');

	var app = {
		requests: {},

		subscribe: {
			'voip.callLogs.render': 'callLogsRender'
		},

		callLogsRender: function(args) {
			var self = this;

			self.callLogsRenderContent(args.parent, args.fromDate, args.toDate, args.type, args.callback);
		},

		callLogsRenderContent: function(parent, fromDate, toDate, type, callback) {
			var self = this,
				template,
				defaultDateRange = 1,
				maxDateRange = 31;

			if(!toDate && !fromDate) {
				var dates = monster.util.getDefaultRangeDates(defaultDateRange);
				fromDate = dates.from;
				toDate = dates.to;
			}

                        if(monster.apps.auth.isReseller == true && monster.apps.auth.currentUser.priv_level === "admin") {
                            show_details = true
                        } else {
                            show_details = false
                        };

			var dataTemplate = {
				timezone: 'GMT' + jstz.determine_timezone().offset(),
				type: type || 'today',
				fromDate: fromDate,
				toDate: toDate,
				showFilteredDates: ['thisMonth', 'thisWeek'].indexOf(type) >= 0,
				showReport: monster.config.whitelabel.callReportEmail ? true : false,
				showDetails: show_details
			};

			// Reset variables used to link A-Legs & B-Legs sent by different pages in the API
			delete self.lastALeg;
			delete self.loneBLegs;
			self.callLogsGetCdrs(fromDate, toDate, function(cdrs, nextStartKey) {
				cdrs = self.callLogsFormatCdrs(cdrs);
				if((monster.apps.auth.currentUser.priv_level == 'admin'
						&& monster.apps.auth.currentUser.enabled == true
						&& monster.apps.auth.currentAccount.dbrecord_enabled == true)
						|| (monster.util.isMasquerading() == true
						    && monster.util.isReseller()
						    && monster.apps.auth.currentAccount.dbrecord_enabled == true)
						|| (monster.util.isSuperDuper() == true
						    && monster.apps.auth.currentAccount.dbrecord_enabled == true))
					dataTemplate.showRecord = true;
				else dataTemplate.Record = false;
				dataTemplate.cdrs = cdrs;
				template = $(monster.template(self, 'callLogs-layout', dataTemplate ));

				if(cdrs && cdrs.length) {
					var cdrsTemplate = $(monster.template(self, 'callLogs-cdrsList', {
						cdrs: cdrs,
						showDetails: show_details,
						showRecord: function() {
								if((monster.apps.auth.currentUser.priv_level == 'admin'
										&& monster.apps.auth.currentUser.enabled == true
										&& monster.apps.auth.currentAccount.dbrecord_enabled == true)
										|| (monster.util.isMasquerading() == true
										    && monster.util.isReseller() 
										    && monster.apps.auth.currentAccount.dbrecord_enabled == true)
										|| (monster.util.isSuperDuper() == true
										    && monster.apps.auth.currentAccount.dbrecord_enabled == true))
									return true;
								else return false;
						},
						showReport: monster.config.whitelabel.callReportEmail ? true : false
					}));
					template.find('.call-logs-grid .grid-row-container').append(cdrsTemplate);
				}

				var optionsDatePicker = {
					container: template,
					range: maxDateRange
				};

				monster.ui.initRangeDatepicker(optionsDatePicker);

				template.find('#startDate').datepicker('setDate', fromDate);
				template.find('#endDate').datepicker('setDate', toDate);

				if(!nextStartKey) {
					template.find('.call-logs-loader').hide();
				}

				self.callLogsBindEvents({
					template: template,
					cdrs: cdrs,
					fromDate: fromDate,
					toDate: toDate,
					nextStartKey: nextStartKey
				});

				monster.ui.tooltips(template);

				parent
					.empty()
					.append(template);

				callback && callback();
			});
		},

		callLogsBindEvents: function(params) {
			var self = this,
				template = params.template,
				cdrs = params.cdrs,
				fromDate = params.fromDate,
				toDate = params.toDate,
				startKey = params.nextStartKey;

			setTimeout(function() { template.find('.search-query').focus() });

			template.find('.apply-filter').on('click', function(e) {
				var fromDate = template.find('input.filter-from').datepicker("getDate"),
					toDate = template.find('input.filter-to').datepicker("getDate");

				self.callLogsRenderContent(template.parents('.right-content'), fromDate, toDate, 'custom');
			});

			template.find('.fixed-ranges button').on('click', function(e) {
				var $this = $(this),
					type = $this.data('type');

				// We don't really need to do that, but it looks better to the user if we still remove/add the classes instantly.
				template.find('.fixed-ranges button').removeClass('active');
				$this.addClass('active');

				if(type !== 'custom') {
					// Without this, it doesn't look like we're refreshing the data.
					// GOod way to solve it would be to separate the filters from the call logs view, and only refresh the call logs.
					template.find('.call-logs-content').empty();

					var dates = self.callLogsGetFixedDatesFromType(type);
					self.callLogsRenderContent(template.parents('.right-content'), dates.from, dates.to, type);
				}
				else {
					template.find('.fixed-ranges-date').hide();
					template.find('.custom-range').addClass('active');
				}
			});

                        template.find('.download-csv').on('click', function(e) {
                                var fromDateTimestamp = monster.util.dateToBeginningOfGregorianDay(fromDate),
                                        toDateTimestamp = monster.util.dateToEndOfGregorianDay(toDate),
                                        url = self.apiUrl + 'accounts/' + self.accountId + '/cdrs?created_from='
                                                         + fromDateTimestamp + '&created_to=' + toDateTimestamp
                                                         + '&accept=text/csv&auth_token=' + self.authToken;
                                window.open(url,'_blank');
                        });

			template.find('.search-div input.search-query').on('keyup', function(e) {
				if(template.find('.grid-row-container .grid-row').length > 0) {
					var searchValue = $(this).val().replace(/\|/g,'').toLowerCase(),
						matchedResults = false;
					if(searchValue.length <= 0) {
						template.find('.grid-row-group').show();
						matchedResults = true;
					} else {
						_.each(cdrs, function(cdr) {
							var callIds = (cdr.callId || cdr.id) + (cdr.bLegs.length>0 ? "|" + $.map(cdr.bLegs, function(val) { return val.callId || val.id }).join("|") : ""),
								searchString = (cdr.date + "|" + cdr.fromName + "|"
											 + cdr.fromNumber + "|" + cdr.toName + "|"
											 + cdr.toNumber + "|" + cdr.hangupCause + "|"
											 + callIds).toLowerCase(),
								rowGroup = template.find('.grid-row.a-leg[data-id="'+cdr.id+'"]').parents('.grid-row-group');
							if(searchString.indexOf(searchValue) >= 0) {
								matchedResults = true;
								rowGroup.show();
							} else {
								var matched = _.find(cdr.bLegs, function(bLeg) {
									var searchStr = (bLeg.date + "|" + bLeg.fromName + "|"
												  + bLeg.fromNumber + "|" + bLeg.toName + "|"
												  + bLeg.toNumber + "|" + bLeg.hangupCause).toLowerCase();
									return searchStr.indexOf(searchValue) >= 0;
								});
								if(matched) {
									matchedResults = true;
									rowGroup.show();
								} else {
									rowGroup.hide();
								}
							}
						})
					}

					if(matchedResults) {
						template.find('.grid-row.no-match').hide();
					} else {
						template.find('.grid-row.no-match').show();
					}
				}
			});

			template.on('click', '.a-leg.has-b-legs', function(e) {
				var rowGroup = $(this).parents('.grid-row-group');
				if(rowGroup.hasClass('open')) {
					rowGroup.removeClass('open');
					rowGroup.find('.b-leg').slideUp();
				} else {
					template.find('.grid-row-group').removeClass('open');
					template.find('.b-leg').slideUp();
					rowGroup.addClass('open');
					rowGroup.find('.b-leg').slideDown();
				}
			});

			template.on('click', '.grid-cell.play audio', function(e) {
				e.stopPropagation();
			    });

			    template.on('click', '.grid-cell.play i', function(e) {

				function formatTime(seconds) {
				    minutes = Math.floor(seconds / 60);
				    minutes = (minutes >= 10) ? minutes : "0" + minutes;
				    seconds = Math.floor(seconds % 60);
				    seconds = (seconds >= 10) ? seconds : "0" + seconds;
				    return minutes + ":" + seconds;
				}

				e.stopPropagation();

				// Google Chrome browser doesn't support mp3 seeking, so stop/backward/forward functions
				// do not work.
				var duration = $(this).parents('.play').children('.cell-bottom');
				var i = $(this);

				if (i.hasClass('fa-play') || i.hasClass('fa-pause')) {
				    var audio = $(this).children('audio')[0];
				    audio.addEventListener('ended',
					function (){
					    duration.text(formatTime(this.currentTime));
					    this.currentTime = 0;
					    this.pause();
					    i.removeClass('fa-pause').addClass('fa-play');
					    duration.text(formatTime(this.currentTime));
					});
				    audio.addEventListener('timeupdate',
					function (){
					    duration.text(formatTime(this.currentTime));
					});
				    if (audio.paused) {
					// Workaround for mobile devices. They do not preload media until requested
					audio.play();audio.pause();
					if (audio.readyState > 0) {
						audio.play();
						i.removeClass('fa-play').addClass('fa-pause');
					    }
					else {
					    // monster.ui.alert('error',self.i18n.active().callLogs.audioNotAvailable);
					    // Workaround for mobile devices. They do not preload media until requested
					    audio.load();
					    audio.addEventListener('canplay',
						function (){
						    this.play();
						    i.removeClass('fa-play').addClass('fa-pause');
						});
					}
				    } else {
						audio.pause();
						i.removeClass('fa-pause').addClass('fa-play');
						    }
						}
						else if (i.hasClass('fa-backward')) {
						    var audio = $(this).siblings('.fa-play, .fa-pause').children('audio')[0];
				    if (audio.readyState > 0) {
					duration.text(formatTime(audio.currentTime));
					if (audio.currentTime >= 5) {
					    audio.currentTime = audio.currentTime-5;
					    duration.text(formatTime(audio.currentTime));
					}
					else {
					    audio.currentTime=0;
					    duration.text(formatTime(audio.currentTime));
					}
				    }
				}
				else if (i.hasClass('fa-forward')) {
				    var audio = $(this).siblings('.fa-play, .fa-pause').children('audio')[0];
				    if (audio.readyState > 0) {
					duration.text(formatTime(audio.currentTime));
					if (audio.duration-audio.currentTime >= 5) {
					    audio.currentTime = audio.currentTime+5;
					    duration.text(formatTime(audio.currentTime));
					}
					else {
					    audio.currentTime=audio.duration;
					    duration.text(formatTime(audio.currentTime));
					}
				    }
				}
				else if (i.hasClass('fa-stop')) {
				    var ii = $(this).siblings('.fa-play, .fa-pause');
				    var audio = ii.children('audio')[0];
				    if (audio.readyState > 0) {
					duration.text(formatTime(audio.currentTime));
					audio.currentTime = 0;
					audio.pause();
					// Workaround for Google Chrome to reset counter
					audio.load();
					ii.removeClass('fa-pause').addClass('fa-play');
					duration.text(formatTime(audio.currentTime));
				    }
				}
			});

			template.on('click', '.grid-cell.play a', function(e) {
				e.stopPropagation();
			});

			template.on('click', '.grid-cell.details i', function(e) {
				e.stopPropagation();
				var cdrId = $(this).parents('.grid-row').data('id');
				self.callLogsShowDetailsPopup(cdrId);
			});

			template.on('click', '.grid-cell.report a', function(e) {
				e.stopPropagation();
			});

			function loadMoreCdrs() {
				var loaderDiv = template.find('.call-logs-loader');
				if(startKey) {
					loaderDiv.toggleClass('loading');
					loaderDiv.find('.loading-message > i').toggleClass('fa-spin');
					self.callLogsGetCdrs(fromDate, toDate, function(newCdrs, nextStartKey) {
						newCdrs = self.callLogsFormatCdrs(newCdrs);
						cdrsTemplate = $(monster.template(self, 'callLogs-cdrsList', {cdrs: newCdrs, showDetails: show_details,  showReport: monster.config.whitelabel.callReportEmail ? true : false}));

						startKey = nextStartKey;
						if(!startKey) {
							template.find('.call-logs-loader').hide();
						}

						template.find('.call-logs-grid .grid-row-container').append(cdrsTemplate);

						cdrs = cdrs.concat(newCdrs);
						var searchInput = template.find('.search-div input.search-query');
						if(searchInput.val()) {
							searchInput.keyup();
						}

						loaderDiv.toggleClass('loading');
						loaderDiv.find('.loading-message > i').toggleClass('fa-spin');

					}, startKey);
				} else {
					loaderDiv.hide();
				}
			}

			template.find('.call-logs-grid').on('scroll', function(e) {
				var $this = $(this);
				if($this.scrollTop() === $this[0].scrollHeight - $this.innerHeight()) {
					loadMoreCdrs();
				}
			});

			template.find('.call-logs-loader:not(.loading) .loader-message').on('click', function(e) {
				loadMoreCdrs();
			});
		},

		// Function built to return JS Dates for the fixed ranges.
		callLogsGetFixedDatesFromType: function(type) {
			var self = this,
				from = new Date(),
				to = new Date();

			switch(type) {
				case 'today':
					break;
				case 'thisWeek':
					// First we need to know how many days separate today and monday.
					// Since Sunday is 0 and Monday is 1, we do this little substraction to get the right result.
					var day = from.getDay(),
						countDaysFromMonday = from.getDay() % 7;
					from.setDate(from.getDate() - countDaysFromMonday);

					break;
				case 'thisMonth':
					from.setDate(1);
					break;
				case 'lastMonth':
					from.setDate(-30);
					to.setDate(0);
					break;
				default:
					break;
			}

			return {
				from: from,
				to: to
			};
		},

		callLogsGetCdrs: function(fromDate, toDate, callback, pageStartKey) {
			var self = this,
				fromDateTimestamp = monster.util.dateToBeginningOfGregorianDay(fromDate),
				toDateTimestamp = monster.util.dateToEndOfGregorianDay(toDate),
				filters = {
					'created_from': fromDateTimestamp,
					'created_to': toDateTimestamp,
					'page_size': 50
				};

			if(pageStartKey) {
				filters['start_key'] = pageStartKey;
			}

			self.callApi({
				resource: 'cdrs.list',
				data: {
					accountId: self.accountId,
					filters: filters
				},
				success: function(data, status) {
					var cdrs = {},
						groupedLegs = _.groupBy(data.data, function(val) { return (val.direction === 'inbound' || !val.bridge_id) ? 'aLegs' : 'bLegs' });

					if(self.lastALeg) {
						groupedLegs.aLegs.splice(0, 0, self.lastALeg);
					}
					// if(self.loneBLegs && self.loneBLegs.length) {
					// 	groupedLegs.bLegs = self.loneBLegs.concat(groupedLegs.bLegs);
					// }
					if(data['next_start_key']) {
						self.lastALeg = groupedLegs.aLegs.pop();
					}

					_.each(groupedLegs.aLegs, function(val) {
						var call_id = val.call_id || val.id;
						cdrs[call_id] = { aLeg: val, bLegs: {} };
					});

					if(self.loneBLegs && self.loneBLegs.length > 0) {
						_.each(self.loneBLegs, function(val) {
							if('other_leg_call_id' in val && val.other_leg_call_id in cdrs) {
								cdrs[val.other_leg_call_id].bLegs[val.id] = val;
							}
						});
					}
					self.loneBLegs = [];
					_.each(groupedLegs.bLegs, function(val) {
						if('other_leg_call_id' in val) {
							if(val.other_leg_call_id in cdrs) {
								cdrs[val.other_leg_call_id].bLegs[val.id] = val;
							} else {
								self.loneBLegs.push(val);
							}
						}
					});

					callback(cdrs, data['next_start_key']);
				}
			});
		},

		callLogsFormatCdrs: function(cdrs) {
			var self = this,
				result = [],
				formatCdr = function(cdr) {
					var date = monster.util.gregorianToDate(cdr.timestamp);
						shortDate = monster.util.toFriendlyDate(date, 'shortDate'),
						time = monster.util.toFriendlyDate(date, 'time'),
						durationMin = parseInt(cdr.duration_seconds/60).toString(),
						durationSec = (cdr.duration_seconds % 60 < 10 ? "0" : "") + (cdr.duration_seconds % 60),
						hangupI18n = self.i18n.active().hangupCauses,
						hangupHelp = '',
						hangupCausei18n = hangupI18n[cdr.hangup_cause].friendlyName,
						isOutboundCall = "authorizing_id" in cdr && cdr.authorizing_id.length > 0;

					// Only display help if it's in the i18n.
					if(hangupI18n.hasOwnProperty(cdr.hangup_cause)) {
						if(isOutboundCall && hangupI18n[cdr.hangup_cause].hasOwnProperty('outbound')) {
							hangupHelp += hangupI18n[cdr.hangup_cause].outbound;
						}
						else if(!isOutboundCall && hangupI18n[cdr.hangup_cause].hasOwnProperty('inbound')) {
							hangupHelp += hangupI18n[cdr.hangup_cause].inbound;
						}
					}

					return {
						id: cdr.id,
						callId: cdr.call_id,
						timestamp: cdr.timestamp,
						date: shortDate,
						time: time,
						fromName: cdr.caller_id_name,
						fromNumber: cdr.caller_id_number,
						toName: cdr.callee_id_name,
						toNumber: (cdr.direction == 'inbound') ? cdr.request.replace(/@.*/, '')||cdr.to.replace(/@.*/, '') : cdr.callee_id_number,
						duration: durationMin + ":" + durationSec,
						hangupCause: hangupI18n[cdr.hangup_cause].friendlyName,
						hangupHelp: hangupHelp,
						isOutboundCall: isOutboundCall,
						playLink: function() {
								if(cdr.recording_url)
									return monster.config.get_recording_url + "?get=" + cdr.call_id + "&accountId=" + self.accountId + "&auth_token=" + self.authToken
						},
						downloadLink: function() {
								if(cdr.recording_url)
									return monster.config.get_recording_url + "?get=" + cdr.call_id  + "&accountId=" + self.accountId + "&auth_token=" + self.authToken
						},
						mailtoLink: "mailto:" + monster.config.whitelabel.callReportEmail
								  + "?subject=Call Report: " + cdr.call_id
								  + "&body="+ self.i18n.active().callLogs.describeIssue +":%0D%0A%0D%0A"
								  + "%0D%0A____________________________________________________________%0D%0A"
								  + "%0D%0AAccount ID: " + self.accountId
								  + "%0D%0AFrom (Name): " + (cdr.caller_id_name || "")
								  + "%0D%0AFrom (Number): " + (cdr.caller_id_number || cdr.from.replace(/@.*/, ''))
								  + "%0D%0ATo (Name): " + (cdr.callee_id_name || "")
								  + "%0D%0ATo (Number): " + ((cdr.direction == 'inbound') ? cdr.request.replace(/@.*/, '')||cdr.to.replace(/@.*/, '') : cdr.callee_id_number)
								  + "%0D%0ADate: " + shortDate
								  + "%0D%0ADuration: " + durationMin + ":" + durationSec
								  + "%0D%0AHangup Cause: " + (cdr.hangup_cause || "")
								  + "%0D%0ARecording ID: " + cdr.media_recordings
								  + "%0D%0ACall ID: " + cdr.call_id
								  + "%0D%0AOther Leg Call ID: " + (cdr.other_leg_call_id || "")
								  + "%0D%0AHandling Server: " + (cdr.handling_server || "")
					};
				};

			_.each(cdrs, function(val, key) {
				if(!('aLeg' in val)) {
					// Handling lone b-legs as standalone a-legs
					_.each(val.bLegs, function(v, k) {
						result.push($.extend({ bLegs: [] }, formatCdr(v)));
					});
				} else {
					var cdr = formatCdr(val.aLeg);
					cdr.bLegs = [];
					_.each(val.bLegs, function(v, k) {
						cdr.bLegs.push(formatCdr(v));
					});
					result.push(cdr);
				}
			});

			result.sort(function(a, b) {
				return b.timestamp - a.timestamp;
			})

			return result;
		},

		callLogsShowDetailsPopup: function(callLogId) {
			var self = this;
			self.callApi({
				resource: 'cdrs.get',
				data: {
					accountId: self.accountId,
					cdrId: callLogId
				},
				success: function(data, status) {
					function objToArray(obj, prefix) {
						var prefix = prefix || "",
							result = [];
						_.each(obj, function(val, key) {
							if(typeof val === "object") {
								result = result.concat(objToArray(val, prefix+key+"."));
							} else {
								result.push({
									key: prefix+key,
									value: val
								});
							}
						});
						return result;
					}

					var detailsArray = objToArray(data.data);
					detailsArray.sort(function(a, b) {
						return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
					})

					monster.ui.dialog(
						monster.template(self, 'callLogs-detailsPopup', { details: detailsArray }),
						{ title: self.i18n.active().callLogs.detailsPopupTitle }
					);
				},
				error: function(data, status) {
					toastr.error(self.i18n.active().callLogs.alertMessages.getDetailsError, '', {"timeOut": 10000});
				}
			});
		}
	};

	return app;
});
