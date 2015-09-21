Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    projectOid:23112780161,
    tagOid:21580021389,
    tagRef: '/tag/21580021389',
    numberOfMonths: 5,
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
    initialStore:null,
    data:[],
    launch: function() {
        this.getDates();
        this.prepare();
        this.createInitialFilters();
        //this._myMask = new Ext.LoadMask(Ext.getBody(), {msg:"Please wait.This may take long depending on your data..."});
        //this._myMask.show();
    },
    getDates:function(){
        var now = new Date();
        var firstDayOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        //console.log('firstDayOfThisMonth',firstDayOfThisMonth); 
        Date.prototype.calcFullMonths = function(monthOffset) {
            var d = new Date(firstDayOfThisMonth); 
            d.setMonth(d.getMonth() - monthOffset);
            return d;
        };
        
        var howFarBack = (new Date()).calcFullMonths(this.numberOfMonths);
        for(var m=1; m <= this.numberOfMonths; m++){
            var firstDayOfNextMonth = new Date(howFarBack.getFullYear(), howFarBack.getMonth() + 1, 1);
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
        //var cvOpenedDateFilter = [];
        //var cvInProgressDateFilter = [];
        //var cvAcceptedDateFilter = [];
        
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
        //applyFiltersToStore(this.makeStore(),cvInProgressDateFilter, this.totalInProgress);
        //applyFiltersToStore(this.makeStore(),cvAcceptedDateFilters, this.totalAccepted);
        
        
    },
    makeStore:function(){
        console.log('makeStore');
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
    
});
