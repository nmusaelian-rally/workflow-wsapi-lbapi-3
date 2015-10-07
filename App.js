
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    projectOid:23112780161,
    tagOid:21580021389,
    tagRef: '/tag/21580021389',
    numberOfMonths: 6,
    intervals:[],
    store:null,
    cvOpenedDateFilter:[],
    cvInProgressDateFilter:[],
    cvAcceptedDateFilter:[],
    unkownToHaveCVtag:[],
    verifiedToHaveCVtag:[],
    counter:0,
    totalAssigned:[],
    assigned:[],
    totalOpened:[],
    opened:[],
    totalInProgress:[],
    inProgress:[],
    totalAccepted:[],
    accepted:[],
    data:[],
    launch: function() {
        this._myMask = new Ext.LoadMask(Ext.getBody(), {msg:"Please wait.This may take long depending on your data..."});
        this._myMask.show();
        this.getDates();
        this.prepare();
        this.createInitialFilters();
    },
    getDates:function(){
        var now = new Date();
        var startNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        console.log('startNextMonth',startNextMonth); 
        Date.prototype.calcFullMonths = function(monthOffset) {
            var d = new Date(startNextMonth); 
            d.setMonth(d.getMonth() - monthOffset);
            return d;
        };
        
        var howFarBack = (new Date()).calcFullMonths(this.numberOfMonths);
        console.log('howFarBack',howFarBack); 
        for(var m=1; m <= this.numberOfMonths; m++){
            var firstDayOfNextMonth = new Date(howFarBack.getFullYear(), howFarBack.getMonth() + 1, 1);
            console.log('firstDayOfNextMonth',firstDayOfNextMonth);
            this.intervals.push({
                'from'  :   Rally.util.DateTime.format(howFarBack, 'Y-m-d'),          //howFarBack.toISOString(),           //or Rally.util.DateTime.format(howFarBack, 'Y-m-d'),
                'to'    :   Rally.util.DateTime.format(firstDayOfNextMonth, 'Y-m-d'), //firstDayOfNextMonth.toISOString()   //Rally.util.DateTime.format(firstDayOfNextMonth, 'Y-m-d'),
                'month' :   howFarBack.toLocaleString('en-us', { month: 'long' })
            });
            
            howFarBack = firstDayOfNextMonth;
        }
    },
    
    prepare:function(){
        //for each interval, create an empty array to hold defects for each transition:
        for (i=0; i < this.intervals.length; i++) {
            this.opened.push([]);
            this.inProgress.push([]);
            this.accepted.push([]);
            this.assigned.push([]);
        }
    },
    
    createInitialFilters:function(){
        var tagFilter = Ext.create('Rally.data.wsapi.Filter', {
             property : 'Tags',
             operator: 'contains',
             value: this.tagRef
        });
        
        var openedDateFilter = Rally.data.wsapi.Filter.and([
            {
                property : 'OpenedDate',
                operator : '>=',
                value : _.first(this.intervals).from
            },
            {
                property : 'OpenedDate',
                operator : '<',
                value : _.last(this.intervals).to
            }
        ]);
        
        this.cvOpenedDateFilter.push(tagFilter.and(openedDateFilter));
        
        var inProgressDateFilter = Rally.data.wsapi.Filter.and([
            {
                property : 'InProgressDate',
                operator : '>=',
                value : _.first(this.intervals).from
            },
            {
                property : 'InProgressDate',
                operator : '<',
                value : _.last(this.intervals).to
            }
        ]);
        
        this.cvInProgressDateFilter.push(tagFilter.and(inProgressDateFilter));
        
         var acceptedDateFilter = Rally.data.wsapi.Filter.and([
            {
                property : 'AcceptedDate',
                operator : '>=',
                value : _.first(this.intervals).from
            },
            {
                property : 'AcceptedDate',
                operator : '<',
                value : _.last(this.intervals).to
            }
        ]);
         
        this.cvAcceptedDateFilter.push(tagFilter.and(acceptedDateFilter)); 
        
        console.log(this.cvOpenedDateFilter.toString());
        console.log(this.cvInProgressDateFilter.toString());
        console.log(this.cvAcceptedDateFilter.toString());
        
        this.makeStore();
        this.applyOpenedFiltersToStore();
    },
    makeStore:function(){
        var store = Ext.create('Rally.data.wsapi.Store',{
            model: 'Defect',
            fetch: ['ObjectID','FormattedID','ScheduleState','State','CreationDate','OpenedDate','ClosedDate','InProgressDate','AcceptedDate'],
            limit: Infinity,
            sorters:[{
                property:'ObjectID',
                order: 'DESC'
            }]
        });
        return store;
    },
    
    
    applyOpenedFiltersToStore:function(){
        var store = this.makeStore();
        store.addFilter(this.cvOpenedDateFilter);
        store.load({
            scope: this,
            callback: function(records, operation) {
                if(operation.wasSuccessful()) {
                    _.each(records, function(record){
                        this.totalOpened.push(this.makeDefectObject(record));
                    },this);   
                    this.onOpenedStoreLoaded();
                }
                else{
                    console.log('oh,noes!');
                }
            }
        });
    },
    
    onOpenedStoreLoaded:function(){
        console.log('this.totalOpened', this.totalOpened.length);
        var n = this.intervals.length;
        _.each(this.totalOpened, function(record){
            for(var i=0; i<n;i++){
                if (record.OpenedDate >= this.intervals[i].from && record.OpenedDate < this.intervals[i].to) {
                    this.opened[i].push(record);
                }
            }
        },this);
        
        this.applyInProgressFiltersToStore();
    },
    
    applyInProgressFiltersToStore:function(){
        var store = this.makeStore();
        store.addFilter(this.cvInProgressDateFilter);
        store.load({
            scope: this,
            callback: function(records, operation) {
                if(operation.wasSuccessful()) {
                    _.each(records, function(record){
                        this.totalInProgress.push(this.makeDefectObject(record));
                    },this);   
                    this.onInProgressStoreLoaded();
                }
                else{
                    console.log('oh,noes!');
                }
            }
        });
    },
    
    onInProgressStoreLoaded:function(){
        //titalInProgress will be used to update this.assigned snapshots with current InProgressDate values
        console.log('this.totalInProgress', this.totalInProgress.length); 
        this.applyAcceptedFiltersToStore();
    },
    
    applyAcceptedFiltersToStore:function(){
        var store = this.makeStore();
        store.addFilter(this.cvAcceptedDateFilter);
        store.load({
            scope: this,
            callback: function(records, operation) {
                if(operation.wasSuccessful()) {
                    _.each(records, function(record){
                        this.totalAccepted.push(this.makeDefectObject(record));
                    },this);  
                    this.onAcceptedStoreLoaded();
                }
                else{
                    console.log('oh,noes!');
                }
            }
        });
    },
    
    onAcceptedStoreLoaded:function(){
        console.log('this.totalAccepted', this.totalAccepted.length);
        var n = this.intervals.length;
        _.each(this.totalAccepted, function(record){
            for(var i=0; i<n;i++){
                if (record.AcceptedDate >= this.intervals[i].from && record.AcceptedDate < this.intervals[i].to) {
                    this.accepted[i].push(record);
                }
            }
        },this);
        
        this.getDefectsAssignedToTeam();
    },
    
    getDefectsAssignedToTeam:function(){
        Ext.create('Rally.data.lookback.SnapshotStore', {
            fetch: ['ObjectID','_ValidFrom','_ValidTo','FormattedID','Project',
                    '_PreviousValues.Project','Tags','OpenedDate','InProgressDate','CreationDate'],
            find: {'_TypeHierarchy':'Defect','_ProjectHierarchy':this.projectOid,
            '_PreviousValues.Project':{'$ne':null},
            '_ValidFrom':{'$gte':_.first(this.intervals).from,'$lt':_.last(this.intervals).to}},
            hydrate: ['Project','_PreviousValues.Project'],
            listeners: {
                load: this.onSnapshotsLoaded, 
                scope: this
            }
            }).load({
                params : {
                    compress : true,
                    removeUnauthorizedSnapshots : true
                }
            });
    },
    
    onSnapshotsLoaded:function(store, records){
        var arrSize = 0;
        _.each(records, function(record){
            if (record.data.Tags.length > 0) { 
                if(this.checkTagOid(record.data.Tags)){
                    this.totalAssigned.push(this.makeSnapshotObject(record.data));
                }
            }
            else{
                this.unkownToHaveCVtag.push(record.data);
            }
        },this);
        
        arrSize = this.unkownToHaveCVtag.length;
        if (arrSize > 0) {
            this.counter = arrSize;
            for(var i=this.counter-1; i>=0;i--){
                this.verify(this.unkownToHaveCVtag[i].ObjectID);
            }
        }
    },
    checkTagOid:function(tags){
        var isThere = _.some(tags, function(tag){
            return tag === this.tagOid;
        },this);
        return isThere;
    },
    verify:function(oid){
        Ext.create('Rally.data.lookback.SnapshotStore', {
            fetch: ['ObjectID','FormattedID','Project','Tags','OpenedDate','CreationDate'],
            find: {'ObjectID':oid,'_TypeHierarchy':'Defect','_ProjectHierarchy':this.projectOid,"__At":"current"},
            hydrate: ['Project']
        }).load({
                callback: function(records, operation, success) {
                    if (records[0] && records[0].data.Tags.length>0) {
                        if(this.checkTagOid(records[0].data.Tags)){
                            //console.log('found cv tag', records[0].data.ObjectID); //this order is indeterminate. I saw 0, 2, 1, and 1, 2, 0
                            this.verifiedToHaveCVtag.push(records[0].data.ObjectID);
                        }
                        //else{console.log('no cv tag');}
                    }
                    //else{console.log('no tags');}
                    
                    this.counter--;
                    if (this.counter === 0) {
                        this.onAssignedDefectsLoaded();
                    }
                },
                scope: this,
                params : {
                    compress : true,
                    removeUnauthorizedSnapshots : true
                }
        }); 
    },
    onAssignedDefectsLoaded:function(){
        _.mixin({
            'findByValues': function(collection, property, values) {
              return _.filter(collection, function(item) {
                return _.contains(values, item[property]);
              });
            }
          });
        
        var filtered = _.findByValues(this.unkownToHaveCVtag, 'ObjectID', this.verifiedToHaveCVtag);
        
        _.each(filtered, function(snapshot){
            this.totalAssigned.push(this.makeSnapshotObject(snapshot));
        },this);
        
        
       
        this.getCurrentInProgressDates();
        this.getCurrentOpenedDates();
       
       var n = this.intervals.length;
        _.each(this.totalAssigned, function(snapshot){
            for(var i=0; i<n;i++){
                if (snapshot.AssignedDate >= this.intervals[i].from && snapshot.AssignedDate < this.intervals[i].to) {
                    this.assigned[i].push(snapshot);
                }
                if (snapshot.InProgressDate !== '') {
                   if (snapshot.InProgressDate >= this.intervals[i].from && snapshot.InProgressDate < this.intervals[i].to) {
                        this.inProgress[i].push(snapshot);
                    }
                }
                
            }
        },this);
        
        this.collectRecords();
       
    },
    
    getCurrentInProgressDates:function(){
        _.each(this.totalAssigned, function(assignedRecord){
            _.each(this.totalInProgress, function(inProgressRecord){
                if (assignedRecord.ObjectID === inProgressRecord.ObjectID &&  assignedRecord.InProgressDate === '') {
                    assignedRecord.InProgressDate = inProgressRecord.InProgressDate;
                } 
            },this);
        },this);
    },
    
    getCurrentOpenedDates:function(){
        _.each(this.totalAssigned, function(assignedRecord){
            _.each(this.totalOpened, function(openedRecord){
                if (assignedRecord.ObjectID === openedRecord.ObjectID &&  assignedRecord.OpenedDate === '') {
                    //console.log('inside loop');
                    assignedRecord.OpenedDate = openedRecord.OpenedDate;
                } 
            },this);
        },this);
    },
    
    collectRecords:function(){
        var n = this.intervals.length;
        for(var i=0; i<n; i++){
            this.processDefectsPerInterval(this.opened[i],i, 'Opened');
            this.processDefectsPerInterval(this.assigned[i],i,'Assigned');
            this.processDefectsPerInterval(this.inProgress[i],i,'In-Progress'); 
            this.processDefectsPerInterval(this.accepted[i],i,'Accepted');
            this.processDefectsPerInterval(this.accepted[i],i,'All');
        }
        this.sortData();
    },
    
    makeDefectObject:function(record){
        return {
            '_ref':record.get('_ref'),
            'ObjectID':record.get('ObjectID'),
            'FormattedID':record.get('FormattedID'),
            'ScheduleState': record.get('ScheduleState'),
            'State': record.get('State'),
            'CreationDate': Rally.util.DateTime.toIsoString(record.get('CreationDate'), false),
            'OpenedDate': Rally.util.DateTime.toIsoString(record.get('OpenedDate'), false),
            'ClosedDate': Rally.util.DateTime.toIsoString(record.get('ClosedDate'), false),
            'InProgressDate': Rally.util.DateTime.toIsoString(record.get('InProgressDate'), false),
            'AcceptedDate': Rally.util.DateTime.toIsoString(record.get('AcceptedDate'), false)   
        };
    },
    makeSnapshotObject:function(record){
        return{
            'AssignedDate':record._ValidFrom,
            'Project':record.Project.Name,
            'ObjectID':record.ObjectID,
            'OpenedDate':record.OpenedDate,
            'InProgressDate':record.InProgressDate,
            'CreationDate':record.CreationDate,
            'FormattedID':record.FormattedID
        };
    },
    processDefectsPerInterval:function(defectsPerInterval, counter, event){
        console.log(event, counter, defectsPerInterval.length);
        var previousEvent = '';
        var start = '';
        var end = '';
        var alternativeStart = 'CreationDate';
        var order = 0;
        var interval = this.intervals[counter].month;
        var chunksOfTime = []; //between events
        var min = 0;
        var max = 0;
        var mean = 0;
        
        if (event === 'Opened') {
            start = 'CreationDate';
            end = 'OpenedDate';
            previousEvent = 'Created';
            order = 1 ;
        }
         else if (event === 'Assigned') {
            start = 'OpenedDate';
            end = 'AssignedDate';
            previousEvent = 'Opened';
            order = 2;
        }
        else if (event === 'In-Progress') {
            start = 'AssignedDate';
            end = 'InProgressDate';
            previousEvent = 'Assigned';
            order = 3;
        }
        else if (event === 'Accepted') {
            start = 'InProgressDate';
            end = 'AcceptedDate';
            previousEvent = 'InProgress';
            order = 4;
        }
        else if (event === 'All') {
            start = 'CreationDate';
            end = 'AcceptedDate';
            previousEvent = 'Created';
            order = 5;
        }
       
        else{} 

        if (event === 'All') {
            event = 'Accepted';
        }
        _.each(defectsPerInterval, function(defect){
            if (defect[start] === '') {
                defect[start] = defect[alternativeStart];
            }
            //chunksOfTime.push(this.getDiffInHours(defect[start], defect[end]));
            chunksOfTime.push(this.getDiffInDays(defect[start], defect[end]));
        },this);
        
        var sum = 0;
        if (chunksOfTime.length > 0) {
            _.each(chunksOfTime, function(t){
                sum = parseFloat((sum + parseFloat(t)).toFixed(2));
                });
                mean = parseFloat((sum/chunksOfTime.length).toFixed(2));
                max = Math.max.apply(Math, chunksOfTime);
        }
        else{
            mean = '--';
            max = '--';
        }
        //_.each(chunksOfTime, function(t){
        //    sum = parseFloat((sum + parseFloat(t)).toFixed(2));
        //});
        //mean = parseFloat((sum/chunksOfTime.length).toFixed(2));
        //max = Math.max.apply(Math, chunksOfTime);
        
        //min = Math.min.apply(Math, chunksOfTime);  //they are all 0s
        
        
        this.data.push({
            'order'         :   order,
            'interval'      :   interval,
            'from'          :   previousEvent,
            'to'            :   event,
            'count'         :   chunksOfTime.length,
            'mean'          :   mean,
            'max'           :   max
            
        });
    },
    
    getDiffInHours:function(isoString1, isoString2){
        var d1 = new Date(isoString1);
        var d2 = new Date(isoString2);
        //Math.abs() because in some cases defect's ScheduleState is set to In-Progress before its State is Open.     
        return (Math.abs((d2 - d1))/3600000).toFixed(2); //milliseconds to hours
        
    },
    
    getDiffInDays:function(isoString1, isoString2){
        var d1 = new Date(isoString1);
        var d2 = new Date(isoString2);
        //Math.abs() because in some cases defect's ScheduleState is set to In-Progress before its State is Open.     
        return (Math.abs((d2 - d1))/86400000).toFixed(2); //milliseconds to days
        
    },
    sortData: function(){
        this.data = _.sortBy(this.data, function(d) {
            return [d.order];
        });
        this.makeGrid();
    },
    makeGrid:function(){
        this._myMask.hide();
        this.add({
            viewConfig: {
                enableTextSelection: true
            },
            xtype: 'rallygrid',
            itemId: 'dataGrid',
            showPagingToolbar: false,
            store: Ext.create('Rally.data.custom.Store', {
                data: this.data,
                pageSize: 30
            }),
            columnCfgs: [
                {text: 'Interval',  dataIndex: 'interval'},
                {text: 'From',  dataIndex: 'from'},
                {text: 'To',  dataIndex: 'to'},
                {text: 'Count',  dataIndex: 'count'},
                {text: 'Time Between Events (Mean)',  dataIndex: 'mean'},
                {text: 'Time Between Events (Max)',  dataIndex: 'max'} 
            ]
        });
    }
    
});